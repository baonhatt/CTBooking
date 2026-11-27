import { PaymentRequest } from '@shared/api';
import { eq, and, asc, isNull, inArray, sql } from 'drizzle-orm';
import { validateVoucherForVRImpl } from '../vouchers';
import { packageAtBranch, packagesAtBranch } from '../../../lib/catalog-scope';
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

  // The order belongs to the branch the customer chose, else the default branch. Every package of the order must be
  // sold there, and its price and movies are those of that branch (server/lib/catalog-scope.ts).
  const targetBranchId = await resolveOrderBranchId(anyDb, branchesTable, Number(branch_id) > 0 ? Number(branch_id) : null);
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

  /** A package as sold at the order's branch; refused when it is hidden, deleted, of the wrong type or not sold there. */
  const packageAtOrderBranch = async (packageId: unknown, type: 'movie' | 'vr') => {
    const pkg = await packageAtBranch(anyDb, Number(packageId), targetBranchId);
    const isVr = pkg?.type === 'vr';
    if (pkg && isVr === (type === 'vr')) {
      checkMemberOnly(pkg, body);
      return pkg;
    }
    const stored = Number(packageId) > 0 ? await findPackage(anyDb, ticketPackagesTable, Number(packageId)) : null;
    if (stored && stored.is_active !== false && !stored.deleted_at && (stored.type === 'vr') === (type === 'vr')) {
      throw new HttpError(400, `Gói ${type === 'vr' ? 'VR' : 'vé'} "${stored.name}" không áp dụng tại chi nhánh bạn chọn.`);
    }
    throw new HttpError(
      404,
      type === 'vr' ? 'Một số gói VR không tồn tại hoặc đã ngừng hoạt động.' : `Gói vé phim (ID: ${packageId}) không tồn tại hoặc đã bị ẩn.`
    );
  };

  let ticketPackage: any = null;
  let unitPrice = 0;
  let movieTotalPrice = 0;
  const movieItemsDetails: Array<{ package_id: number; quantity: number; price: number; name: string }> = [];
  const movie_items = body.movie_items;

  if (movie_items && Array.isArray(movie_items) && movie_items.length > 0) {
    let calculatedTicketCount = 0;
    for (const item of movie_items) {
      const pkg: any = await packageAtOrderBranch(item.package_id, 'movie');
      const price = Number(pkg.price || 0);
      const qty = normalizeQuantity(item.quantity);
      movieTotalPrice += price * qty;
      calculatedTicketCount += qty;
      movieItemsDetails.push({ package_id: pkg.id, quantity: qty, price, name: pkg.name });
      if (!ticketPackage) ticketPackage = pkg;
    }
    ticketPackageId = ticketPackage.id;
    unitPrice = Number(ticketPackage.price || 0);
    // Override ticketCount with calculated value from payload items
    ticketCount = calculatedTicketCount;
    // The limit is checked again here: the count sent by the browser was replaced by the real total from the items
    if (ticketCount > MAX_TICKET_PER_ORDER) {
      throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
    }
  } else if (ticketPackageId) {
    ticketPackage = await packageAtOrderBranch(ticketPackageId, 'movie');
  } else {
    // No package named: the first movie package sold at the branch
    const [firstPackage] = await packagesAtBranch(anyDb, targetBranchId, 'movie');
    if (!firstPackage) {
      throw new HttpError(400, 'Không tìm thấy gói vé khả dụng.');
    }
    checkMemberOnly(firstPackage, body);
    ticketPackage = firstPackage;
  }

  // The movies of the order: the movies of the package at this branch. The browser may only pick among them.
  const packageMovies: any[] = Array.isArray(ticketPackage?.movies) ? ticketPackage.movies : [];
  const packageMovieIds = packageMovies.map((movie: any) => Number(movie.id));
  let movies: any[] = packageMovies;
  if (combo && Array.isArray(combo) && combo.length > 0) {
    const chosenIds = parseIdList(combo);
    if (chosenIds.length !== combo.length || chosenIds.some((movieId) => !packageMovieIds.includes(movieId))) {
      throw new HttpError(400, 'Phim đã chọn không thuộc gói vé này tại chi nhánh bạn chọn.');
    }
    movies = packageMovies.filter((movie: any) => chosenIds.includes(Number(movie.id)));
  }

  let branchSettings: any = {};
  try {
    branchSettings = branch.settings ? JSON.parse(branch.settings) : {};
  } catch (e) {
    branchSettings = {};
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
    for (const it of vr_items) {
      const pkg: any = await packageAtOrderBranch(it.vr_package_id, 'vr');
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
