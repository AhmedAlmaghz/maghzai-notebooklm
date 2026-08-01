import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "يرجى إدخال البريد الإلكتروني وكلمة المرور" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (!user) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 400 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 400 });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    const token = await createToken(userPayload);
    await setAuthCookie(token);

    return NextResponse.json({ user: userPayload });
  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تسجيل الدخول" }, { status: 500 });
  }
}
