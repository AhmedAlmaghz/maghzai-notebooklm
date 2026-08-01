import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (existing) {
      return NextResponse.json({ error: "هذا البريد الإلكتروني مُسجل بالفعل" }, { status: 400 });
    }

    // Hash password & insert
    const hashedPassword = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
      })
      .returning();

    const userPayload = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    };

    const token = await createToken(userPayload);
    await setAuthCookie(token);

    return NextResponse.json({ user: userPayload });
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إنشاء الحساب" }, { status: 500 });
  }
}
