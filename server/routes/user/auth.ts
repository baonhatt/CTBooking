import type { Login, Register } from "@shared/api";
import { eq, desc, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sendMail } from "../mail-service";
import { getWelcomeEmailTemplate } from "../../lib/booking-utils";

export async function loginImpl(anyDb: any, tables: { accounts: any; users: any }, payload: Partial<Login>) {
  const email = payload.email || "";
  const password = payload.password || "";
  const useracc = await anyDb.query.accounts.findFirst({
    where: eq(tables.accounts.email, email),
  });
  if (!useracc) {
    return { status: "error", message: "Email không tồn tại!" };
  }
  const isPasswordValid = await bcrypt.compare(password, useracc.password || "");
  if (!isPasswordValid) {
    return { status: "error", message: "Mật khẩu không đúng!" };
  }
  const user = await anyDb.query.users.findFirst({
    where: eq(tables.users.id, useracc.user_id),
  });
  return {
    status: "success",
    message: "Đăng nhập thành công!",
    user: { username: user?.fullname, email },
  };
}

export async function registerImpl(anyDb: any, tables: { accounts: any; users: any }, payload: Partial<Register> & { gender?: string; dob?: string; phone?: string; name?: string }, sendMailFn?: (to: string, subject: string, html: string) => Promise<any>, getWelcomeEmailHtml?: (data: { customerName: string; email: string }) => string) {
  try {
    const { email, password } = payload;
    const gender = payload.gender;
    const dobStr = payload.dob;
    const phone = payload.phone;
    const now = new Date().toISOString();

    if (!email || !password) {
      return { status: "error", message: "Email và mật khẩu không được để trống!" };
    }

    const existing = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.email, email) });
    if (existing) {
      return { status: "error", message: "Email đã tồn tại" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let fullname = payload.name;
    if (!fullname || fullname.trim() === "") {
      fullname = email.split("@")[0];
    }

    let dob: string | undefined;
    if (dobStr && typeof dobStr === "string" && dobStr.trim()) {
      const d = new Date(dobStr);
      if (!isNaN(d.getTime())) {
        dob = d.toISOString();
      }
    }

    // D1/SQLite có thể không hỗ trợ transaction đầy đủ như Postgres
    // Nên tách ra thành các bước riêng, nhưng vẫn đảm bảo thứ tự: USER → ACCOUNT

    // Step 1: Tạo USER trước (vì account cần user_id - foreign key constraint)
    await anyDb.insert(tables.users).values({
      fullname: fullname,
      phone: phone,
      gender: gender,
      dob: dob,
      created_at: now,
      updated_at: now,
    });

    // Query lại user vừa tạo (tương thích với D1/SQLite không hỗ trợ .returning())
    const whereConditions = [];
    if (phone) {
      whereConditions.push(eq(tables.users.phone, phone));
    }
    if (fullname) {
      whereConditions.push(eq(tables.users.fullname, fullname));
    }

    // Lấy user mới nhất theo điều kiện hoặc lấy user mới nhất nếu không có điều kiện
    let user;
    if (whereConditions.length > 0) {
      const users = await anyDb.select().from(tables.users)
        .where(and(...whereConditions))
        .orderBy(desc(tables.users.id))
        .limit(1);
      user = users[0];
    } else {
      // Fallback: lấy user mới nhất nếu không có phone/fullname
      const users = await anyDb.select().from(tables.users)
        .orderBy(desc(tables.users.id))
        .limit(1);
      user = users[0];
    }

    if (!user) throw new Error("Không thể tạo thông tin người dùng (Insert failed)");

    // Step 2: Tạo ACCOUNT sau (với user_id từ user vừa tạo)
    await anyDb.insert(tables.accounts).values({
      user_id: user.id,
      email,
      password: hashedPassword,
      login_type: "email",
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    const newUser = user;

    try {
      let html = "";
      const templateData = {
        customerName: fullname || email.split("@")[0],
        email,
      };

      if (getWelcomeEmailHtml) {
        html = getWelcomeEmailHtml(templateData);
      } else {
        html = getWelcomeEmailTemplate(templateData);
      }

      const mailer = sendMailFn || sendMail;
      await mailer(email, "🎉 Chào mừng bạn đến CINESPHERE", html);
    } catch (mailErr: any) {
      console.error(`[${new Date().toISOString()}] ERROR in registerImpl email sending:`);
      console.error(`Message: ${mailErr?.message || String(mailErr)}`);
      // We do NOT rollback user creation on email failure to avoid "ghost accounts" in the sense of 
      // "Error returned but Account Created". We return Success with a log.
      // If we wanted to enforce "No Account if Email Fails", we would need to delete the user here 
      // or move email inside transaction (bad for performance).
      return {
        status: "success",
        message: "Đăng ký thành công (nhưng gửi email thất bại)",
        user: { id: newUser.id, email },
        emailError: mailErr?.message || String(mailErr),
      };
    }

    return {
      status: "success",
      message: "Đăng ký thành công",
      user: { id: newUser.id, email },
      emailSent: true,
    };
  } catch (err: any) {
    console.error(err);
    return { status: "error", message: `Server error: ${err?.message || String(err)}` };
  }
}

