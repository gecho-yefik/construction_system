import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function redirectToAuth(requestUrl: URL, params: Record<string, string>) {
    const authUrl = new URL("/auth", requestUrl);
    for (const [key, value] of Object.entries(params)) {
        authUrl.searchParams.set(key, value);
    }
    return NextResponse.redirect(authUrl);
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const token = requestUrl.searchParams.get("token");

    if (!token) {
        return redirectToAuth(requestUrl, {
            verified: "false",
            error: "Verification token is missing",
        });
    }

    try {
        const verification = await prisma.verificationToken.findUnique({
            where: { token },
        });

        if (!verification || verification.expires <= new Date()) {
            if (verification) {
                await prisma.verificationToken.delete({ where: { token } });
            }
            return redirectToAuth(requestUrl, {
                verified: "false",
                error: "Verification token is invalid or expired",
            });
        }

        await prisma.$transaction(async (transaction) => {
            await transaction.user.update({
                where: { email: verification.identifier },
                data: { emailVerified: new Date() },
            });
            await transaction.verificationToken.delete({ where: { token } });
        });

        return redirectToAuth(requestUrl, {
            verified: "true",
            email: verification.identifier,
        });
    } catch (error) {
        console.error("Email verification failed:", error);
        return redirectToAuth(requestUrl, {
            verified: "false",
            error: "Unable to verify email address",
        });
    }
}

