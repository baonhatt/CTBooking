
import { registerImpl } from "../../server/routes/user/auth";
import { logSystemError } from "./utils";

// Mock DB
const mockDb = {
  transaction: async (cb: any) => {
    const tx = {
      insert: () => ({ values: () => ({ returning: () => [{ id: 123, email: "test@example.com" }] }) })
    };
    return cb(tx);
  },
  query: {
    accounts: { findFirst: () => null }
  }
};

// Mock Mailer
const mockMailer = async (to: string, sub: string, html: string) => {
  console.log(`[Mock] Email sent to ${to} with subject "${sub}"`);
  return { ok: true };
};

// Mock Mailer Error
const mockMailerError = async (to: string, sub: string, html: string) => {
  console.log(`[Mock] Attempting to send email to ${to}... FAILED`);
  throw new Error("SMTP Timeout");
};

async function testRegistrationFlow() {
  console.log("--- Testing Registration Flow ---");
  
  const tables = { accounts: {}, users: {} } as any;

  // Case 1: Success
  console.log("\n1. Testing Success Case...");
  const res1 = await registerImpl(mockDb, tables, { email: "test@example.com", password: "123" }, mockMailer);
  console.log("Result:", res1);
  if (res1.status === "success") console.log("PASS: Registration succeeded.");
  else console.log("FAIL: Registration failed.");

  // Case 2: Email Error (Soft Fail)
  console.log("\n2. Testing Email Error Case (Should Soft Fail)...");
  const res2 = await registerImpl(mockDb, tables, { email: "fail@example.com", password: "123" }, mockMailerError);
  console.log("Result:", res2);
  if (res2.status === "success") console.log("PASS: Registration succeeded despite email error (Account created).");
  else console.log("FAIL: Registration failed on email error.");
  
  // Case 3: DB Error
  const mockDbError = {
     query: { accounts: { findFirst: () => null } },
     transaction: () => { throw new Error("DB Connection Failed"); }
  };
  console.log("\n3. Testing DB Error Case...");
  const res3 = await registerImpl(mockDbError, tables, { email: "db@example.com", password: "123" }, mockMailer);
  console.log("Result:", res3);
  if (res3.status === "error") console.log("PASS: Registration failed on DB error.");
  else console.log("FAIL: Registration succeeded despite DB error.");
}

// Run test if called directly
if (require.main === module) {
  testRegistrationFlow().catch(console.error);
}

export { testRegistrationFlow };
