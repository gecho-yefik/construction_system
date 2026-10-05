import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const ErrorCodes = {
    EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
    USERNAME_ALREADY_EXISTS: "USERNAME_ALREADY_EXISTS",
} as const;

export class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode = 400,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export function handleApiError(error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode },
        );
    }

    if (error instanceof ZodError) {
        return NextResponse.json(
            { error: error.issues[0]?.message ?? "Invalid request" },
            { status: 400 },
        );
    }

    console.error("API request failed:", error);
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
    );
}