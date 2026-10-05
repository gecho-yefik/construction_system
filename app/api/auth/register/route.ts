import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";
import { handleApiError, AppError, ErrorCodes } from "@/lib/error-handler";
import { createSuccessResponse } from "@/lib/api-response";

// Update schema to include username
const Schema = z.object({
    email: z.string().email(),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[a-zA-Z]/, "Password must contain at least one letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain at least one special character"),
    name: z.string().min(1, "Name is required"),
    username: z.string()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must be less than 30 characters")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

export async function POST(req: Request) {
    try {
        // Extract username from request body
        const { email, password, name, username } = Schema.parse(await req.json());

        // Check if user already exists by email
        const existingUserByEmail = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUserByEmail) {
            throw new AppError(
                ErrorCodes.EMAIL_ALREADY_EXISTS,
                "User with this email already exists",
                409
            );
        }

        // Check if username is already taken
        const existingUserByUsername = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUserByUsername) {
            throw new AppError(
                ErrorCodes.USERNAME_ALREADY_EXISTS || "USERNAME_ALREADY_EXISTS",
                "Username is already taken",
                409
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user with username
        const user = await prisma.user.create({
            data: {
                email,
                name,
                username, // Add username here
                password: hashedPassword,
                emailVerified: null, // Always require verification
            },
            select: {
                id: true,
                email: true,
                name: true,
                username: true, // Include username in response
                role: true,
                createdAt: true
            }
        });

        // Generate verification token
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.verificationToken.create({
            data: {
                identifier: email,
                token,
                expires,
            },
        });

        // Send verification email (try to send, but don't fail if email service isn't configured)
        try {
            await sendVerificationEmail({ email, token });
        } catch (emailError) {
            console.warn('Failed to send verification email:', emailError);
        }

        return createSuccessResponse(
            {
                user,
                verificationRequired: true,
                verificationToken: process.env.NODE_ENV === 'development' ? token : undefined // Include token in dev for testing
            },
            "Registration successful! Please check your email to verify your account before logging in.",
            201
        );

    } catch (error) {
        return handleApiError(error);
    }
}