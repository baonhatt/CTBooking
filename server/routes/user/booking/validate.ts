import { PaymentRequest } from '@shared/api';
import { eq, and, asc, isNull, inArray, sql } from 'drizzle-orm';
import { validateVoucherForVRImpl, matchesBranch } from '../vouchers';
import { HttpError, MAX_TICKET_PER_ORDER, BookingValidationResult } from './shared';

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
  if (ticketCount > MAX_TICKET_PER_ORDER) {
    throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
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
      const targetBranchId = pkg.branch_id || branch_id;
      if (!matchesBranch(pkg.branch_ids, targetBranchId)) {
        throw new HttpError(400, `Gói vé "${pkg.name}" không áp dụng tại chi nhánh bạn chọn.`);
      }
      const price = Number(pkg.price || 0);
      const qty = Math.max(1, Number(item.quantity || 1));

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
  } else if (ticketPackageId) {
    ticketPackage = await anyDb.query.ticket_packages.findFirst({
      where: eq(ticketPackagesTable.id, ticketPackageId)
    });
    if (!ticketPackage || ticketPackage.is_active === false || ticketPackage.deleted_at !== null) {
      throw new HttpError(404, 'Gói vé không hợp lệ hoặc đã tắt.');
    }
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

  // Determine combo IDs if passed explicitly or attached to ticketPackage
  let comboIds: number[] = [];
  if (combo && Array.isArray(combo) && combo.length > 0) {
    comboIds = combo.map((id) => Number(id)).filter((id) => !isNaN(id));
  } else if (ticketPackage?.combo) {
    try {
      const parsed = typeof ticketPackage.combo === 'string' ? JSON.parse(ticketPackage.combo) : ticketPackage.combo;
      if (Array.isArray(parsed)) {
        comboIds = parsed.map((id: any) => Number(id)).filter((id) => !isNaN(id));
      }
    } catch {}
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

  // Branch check: Ensure the branch is open
  let branchSettings: any = {};
  const targetBranchId = ticketPackage.branch_id || branch_id;
  if (ticketPackage && !matchesBranch(ticketPackage.branch_ids, targetBranchId)) {
    throw new HttpError(400, `Gói vé "${ticketPackage.name}" không áp dụng tại chi nhánh bạn chọn.`);
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
      const qty = Math.max(1, Number(it.quantity || 1));
      const price = Number(pkg.price || 0);
      const lineTotal = price * qty;
      vrTotalPrice += lineTotal;
      vrItemsDetails.push({
        vr_package_id: pkg.id,
        quantity: qty,
        unit_price: price,
        package_name: pkg.name,
        line_total: lineTotal,
        branch_id: pkg.branch_id || targetBranchId || null
      });
    }
  }

  const originalTotalPrice = movieTotalPrice + vrTotalPrice;
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
    return {
      status: 200,
      user: result.user,
      movies: result.movies.map((movie) => ({
        id: movie.id,
        title: movie.title,
        is_active: movie.is_active,
        duration_min: movie.duration_min,
        cover_image: movie.cover_image
      })),
      ticketPackage: {
        id: result.ticketPackage.id,
        name: result.ticketPackage.name,
        price: Number(result.ticketPackage.price || 0)
      },
      unitPrice: result.unitPrice,
      movieTotalPrice: result.movieTotalPrice,
      vrItems: result.vrItemsDetails || [],
      vrTotalPrice: result.vrTotalPrice,
      originalTotalPrice: result.originalTotalPrice,
      voucherDiscountAmount: result.voucherDiscountAmount,
      voucherDetails: result.voucherDetails,
      totalPrice: result.totalPrice,
      movieItemsDetails: result.movieItemsDetails
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}
