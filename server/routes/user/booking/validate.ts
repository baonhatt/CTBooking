import { PaymentRequest } from '@shared/api';
import { eq, and, asc, isNull, inArray, sql } from 'drizzle-orm';
import { validateVoucherForVRImpl, packageServesBranch } from '../vouchers';
import { HttpError, MAX_TICKET_PER_ORDER, BookingValidationResult, normalizeQuantity } from './shared';
import { resolveOrderBranchId } from '../../../lib/booking-branch';
import { isValidCustomerName, isValidCustomerEmail, NAME_MAX_LENGTH } from '../../../lib/customer-input';

/** A list of ids from JSON text or an array (bad entries dropped). */
function parseIdList(value: any): number[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map((id: any) => Number(id)).filter((id) => Number.isInteger(id) && id > 0) : [];
  } catch {
    return [];
  }
}

/** Member-only packages need a signed-in customer (taken from the session by the route, never from the form). */
function checkMemberOnly(pkg: any, body: any) {
  if (pkg?.is_member_only && !(Number(body?.signed_in_account_id) > 0)) {
    throw new HttpError(403, 'Gói này chỉ dành cho thành viên. Vui lòng đăng nhập để đặt.');
  }
}

async function findPackage(anyDb: any, ticketPackagesTable: any, packageId: number) {
  return anyDb.query.ticket_packages.findFirst({ where: eq(ticketPackagesTable.id, packageId) });
}

export async function validateBookingInput(
  anyDb: any,
  body: PaymentRequest,
  tables: {
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
    branches: any;
    vouchers?: any;
    voucher_redemption_logs?: any;
  }
): Promise<BookingValidationResult> {
  let { ticketCount, ticketPackageId } = body;
  const { email, emailBook, phone, name, combo, vr_items, voucher_code, branch_id } = body;

  if (!email || !phone || !emailBook || !name || !ticketCount || ticketCount <= 0) {
    throw new HttpError(400, 'Vui lòng nhập đầy đủ thông tin hợp lệ.');
  }
  // A count that is not a whole number (text, 1.5) is refused here, not left to fail later in the database
  if (!Number.isInteger(Number(ticketCount))) {
    throw new HttpError(400, 'Số lượng không hợp lệ.');
  }
  ticketCount = Number(ticketCount);
  if (ticketCount > MAX_TICKET_PER_ORDER) {
    throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
  }
  if (!isValidCustomerName(name)) {
    throw new HttpError(400, `Họ tên không hợp lệ (tối đa ${NAME_MAX_LENGTH} ký tự, không chứa < hoặc >).`);
  }
  if (!isValidCustomerEmail(email) || !isValidCustomerEmail(emailBook)) {
    throw new HttpError(400, 'Email không hợp lệ.');
  }
  const usersTable = tables.users;
  const accountsTable = tables.accounts;
  const moviesTable = tables.movies;
  const ticketPackagesTable = tables.ticket_packages;
  const branchesTable = tables.branches;

  const userResult = await anyDb
    .select({
      id: usersTable.id,
      fullname: usersTable.fullname,
      phone: usersTable.phone,
      email: accountsTable.email
    })
    .from(usersTable)
    .innerJoin(accountsTable, eq(usersTable.id, accountsTable.user_id))
    .where(eq(accountsTable.email, email))
    .limit(1);

  const user = userResult[0];
  const userEmail = user?.email || email;

  // The order belongs to the branch the customer chose. A package can be sold at several branches, so the package's
  // own (first) branch is only a fallback for old clients that send no branch; then the default branch.
  const requestedBranchId = Number(branch_id) > 0 ? Number(branch_id) : null;

  let ticketPackage: any = null;
  let unitPrice = 0;
  let movieTotalPrice = 0;
  let movieItemsDetails: Array<{ package_id: number; quantity: number; price: number; name: string }> = [];
  const movie_items = body.movie_items;

  if (movie_items && Array.isArray(movie_items) && movie_items.length > 0) {
    const pkgIds = movie_items.map((i: any) => i.package_id);
    const pkgs = await anyDb.query.ticket_packages.findMany({
      where: and(
        inArray(ticketPackagesTable.id, pkgIds),
        sql`(${ticketPackagesTable.type} IS NULL OR ${ticketPackagesTable.type} != 'vr')`
      )
    });
    const pkgsMap = new Map(pkgs.map((p: any) => [p.id, p]));
    let calculatedTicketCount = 0;

    for (const item of movie_items) {
      const pkg: any = pkgsMap.get(item.package_id);
      if (!pkg || pkg.is_active === false || pkg.deleted_at !== null) {
        throw new HttpError(404, `Gói vé phim (ID: ${item.package_id}) không tồn tại hoặc đã bị ẩn.`);
      }
      checkMemberOnly(pkg, body);
      const price = Number(pkg.price || 0);
      const qty = normalizeQuantity(item.quantity);

      movieTotalPrice += price * qty;
      calculatedTicketCount += qty;

      movieItemsDetails.push({
        package_id: pkg.id,
        quantity: qty,
        price: price,
        name: pkg.name
      });
    }

    ticketPackageId = pkgs[0].id;
    ticketPackage = pkgs[0];
    unitPrice = Number(pkgs[0].price || 0);
    // Override ticketCount with calculated value from payload items
    ticketCount = calculatedTicketCount;
    // The limit is checked again here: the count sent by the browser was replaced by the real total from the items
    if (ticketCount > MAX_TICKET_PER_ORDER) {
      throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
    }
  } else if (ticketPackageId) {
    ticketPackage = await anyDb.query.ticket_packages.findFirst({
      where: eq(ticketPackagesTable.id, ticketPackageId)
    });
    if (!ticketPackage || ticketPackage.is_active === false || ticketPackage.deleted_at !== null) {
      throw new HttpError(404, 'Gói vé không hợp lệ hoặc đã tắt.');
    }
    checkMemberOnly(ticketPackage, body);
  } else {
    ticketPackage = await anyDb.query.ticket_packages.findFirst({
      where: and(
        eq(ticketPackagesTable.is_active, true),
        isNull(ticketPackagesTable.deleted_at),
        sql`(${ticketPackagesTable.type} IS NULL OR ${ticketPackagesTable.type} != 'vr')`
      ),
      orderBy: [asc(ticketPackagesTable.display_order), asc(ticketPackagesTable.price)]
    });
    if (!ticketPackage) {
      throw new HttpError(400, 'Không tìm thấy gói vé khả dụng.');
    }
  }

  // The movies of the order (the package's "combo" of movies). They come from the package; the browser may only pick
  // among them, never add a movie the package does not include.
  const packageMovieIds = parseIdList(ticketPackage?.combo);
  let comboIds: number[] = packageMovieIds;
  if (combo && Array.isArray(combo) && combo.length > 0) {
    const chosenIds = parseIdList(combo);
    if (packageMovieIds.length > 0 && chosenIds.some((movieId) => !packageMovieIds.includes(movieId))) {
      throw new HttpError(400, 'Phim đã chọn không thuộc gói vé này.');
    }
    comboIds = chosenIds;
  }

  let movies: any[] = [];
  if (comboIds.length > 0) {
    movies = await anyDb.query.movies.findMany({
      where: and(inArray(moviesTable.id, comboIds), eq(moviesTable.is_active, true), isNull(moviesTable.deleted_at))
    });

    if (combo && Array.isArray(combo) && combo.length > 0 && movies.length !== combo.length) {
      throw new HttpError(404, 'Một số phim trong combo không hợp lệ hoặc đã ngừng hoạt động.');
    }
  }

  // Branch check: the chosen branch, every package of the order must be sold there, and it must be open
  let branchSettings: any = {};
  const targetBranchId = await resolveOrderBranchId(anyDb, branchesTable, requestedBranchId || ticketPackage.branch_id);
  if (ticketPackage && !packageServesBranch(ticketPackage, targetBranchId)) {
    throw new HttpError(400, `Gói vé "${ticketPackage.name}" không áp dụng tại chi nhánh bạn chọn.`);
  }
  for (const item of movieItemsDetails) {
    const pkg = movie_items && movie_items.length > 0 ? await findPackage(anyDb, ticketPackagesTable, item.package_id) : null;
    if (pkg && !packageServesBranch(pkg, targetBranchId)) {
      throw new HttpError(400, `Gói vé "${pkg.name}" không áp dụng tại chi nhánh bạn chọn.`);
    }
  }
  if (targetBranchId) {
    const branch = await anyDb.query.branches.findFirst({
      where: and(eq(branchesTable.id, targetBranchId), isNull(branchesTable.deleted_at))
    });
    if (!branch) {
      throw new HttpError(404, 'Chi nhánh không tồn tại.');
    }
    if (!branch.is_active) {
      throw new HttpError(403, 'Chi nhánh hiện đang ngừng hoạt động.');
    }
    if (!branch.is_open) {
      throw new HttpError(403, 'Chi nhánh hiện đang đóng cửa. Vui lòng quay lại sau.');
    }
    // Parse branch settings
    try {
      branchSettings = branch.settings ? JSON.parse(branch.settings) : {};
    } catch (e) {
      branchSettings = {};
    }
  }

  if (!movie_items || movie_items.length === 0) {
    unitPrice = Number(ticketPackage.price || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new HttpError(400, 'Giá vé không hợp lệ.');
    }
    movieTotalPrice = unitPrice * ticketCount;
    movieItemsDetails.push({
      package_id: ticketPackage.id,
      quantity: ticketCount,
      price: unitPrice,
      name: ticketPackage.name
    });
  }

  // Process VR Items (if any)
  const vrItemsDetails: Array<{
    vr_package_id: number;
    quantity: number;
    unit_price: number;
    package_name: string;
    line_total: number;
    branch_id?: number | null;
  }> = [];
  let vrTotalPrice = 0;

  if (vr_items && Array.isArray(vr_items) && vr_items.length > 0) {
    const vrPackageIds = vr_items.map((i) => i.vr_package_id);
    const vrPkgs = await anyDb.query.ticket_packages.findMany({
      where: and(
        inArray(ticketPackagesTable.id, vrPackageIds),
        eq(ticketPackagesTable.type, 'vr'),
        eq(ticketPackagesTable.is_active, true),
        isNull(ticketPackagesTable.deleted_at)
      )
    });

    if (vrPkgs.length !== vrPackageIds.length) {
      throw new HttpError(404, 'Một số gói VR không tồn tại hoặc đã ngừng hoạt động.');
    }

    const vrPkgMap = new Map(vrPkgs.map((p: any) => [p.id, p]));
    for (const it of vr_items) {
      const pkg: any = vrPkgMap.get(it.vr_package_id);
      if (!pkg) continue;

      if (!packageServesBranch(pkg, targetBranchId)) {
        throw new HttpError(400, `Gói VR "${pkg.name}" không áp dụng tại chi nhánh bạn chọn.`);
      }
      checkMemberOnly(pkg, body);

      const qty = normalizeQuantity(it.quantity);
      const price = Number(pkg.price || 0);
      const lineTotal = price * qty;
      vrTotalPrice += lineTotal;
      vrItemsDetails.push({
        vr_package_id: pkg.id,
        quantity: qty,
        unit_price: price,
        package_name: pkg.name,
        line_total: lineTotal,
        branch_id: targetBranchId
      });
    }
  }

  const originalTotalPrice = movieTotalPrice + vrTotalPrice;
  // A package priced 0 is a setup mistake: never an order without anything to pay (only a 100% voucher makes 0đ)
  if (!Number.isFinite(originalTotalPrice) || originalTotalPrice <= 0) {
    throw new HttpError(400, 'Giá vé không hợp lệ.');
  }
  let voucherDiscountAmount = 0;
  let voucherDetails: any = null;

  // Validate Voucher (if provided and vouchers table exists)
  if (voucher_code && tables.vouchers) {
    // Build vr_price_map from already-fetched VR package data
    const vrPriceMap = new Map<number, number>();
    for (const it of vrItemsDetails) vrPriceMap.set(it.vr_package_id, it.unit_price);

    const vRes = await validateVoucherForVRImpl(anyDb, tables as any, {
      code: voucher_code,
      vr_items: vr_items || [],
      ticket_package_id: ticketPackage?.id ? Number(ticketPackage.id) : undefined,
      movie_items: movieItemsDetails,
      movie_subtotal: movieTotalPrice, // unitPrice × ticketCount (correct total)
      vr_subtotal: vrTotalPrice,
      vr_price_map: vrPriceMap,
      branch_id: targetBranchId,
      user_id: user?.id ?? undefined,
      email: emailBook || userEmail,
      order_total_before: originalTotalPrice
    });
    if (!vRes.valid) {
      throw new HttpError(400, vRes.message || 'Mã giảm giá không hợp lệ');
    }
    if (vRes.valid && vRes.discount_amount) {
      voucherDiscountAmount = Math.min(originalTotalPrice, vRes.discount_amount);
      voucherDetails = vRes.voucher_details;
    }
  }

  const totalPrice = Math.max(0, originalTotalPrice - voucherDiscountAmount);

  return {
    branchId: targetBranchId,
    user: {
      id: user?.id ?? null,
      email: userEmail,
      fullname: user?.fullname ?? name,
      phone: user?.phone ?? phone
    },
    movies,
    ticketPackage,
    unitPrice,
    movieTotalPrice,
    vrItemsDetails,
    vrTotalPrice,
    voucherDetails,
    voucherDiscountAmount,
    originalTotalPrice,
    totalPrice,
    movieItemsDetails
  };
}

export async function validateBookingImpl(
  anyDb: any,
  payload: PaymentRequest,
  tables: {
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
    branches: any;
    vouchers?: any;
    voucher_redemption_logs?: any;
  }
) {
  try {
    const result = await validateBookingInput(anyDb, payload, tables);
    // Only the prices go back to the browser. The account found from the typed email and the voucher's internal
    // details (Sales person, usage counters) stay on the server.
    return {
      status: 200,
      originalTotalPrice: result.originalTotalPrice,
      voucherDiscountAmount: result.voucherDiscountAmount,
      totalPrice: result.totalPrice
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}
