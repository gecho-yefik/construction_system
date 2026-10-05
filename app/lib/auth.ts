// lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import bcrypt from "bcrypt";
export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    debug: true,
    providers: [
        GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID || "",
            clientSecret: env.GOOGLE_CLIENT_SECRET || "",
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    prompt: "select_account",
                    access_type: "offline",
                    response_type: "code",
                    scope: "openid email profile",
                },
            },
            // Fix the profile callback - this is how Google returns data
            async profile(profile) {
                console.log("Google profile data:", profile); // Debug log

                const email = profile.email ?? "";
                const usernameBase =
                    email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) ||
                    "user";
                let username = usernameBase;
                let suffix = 1;

                while (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
                    const suffixText = String(suffix++);
                    username = `${usernameBase.slice(0, 30 - suffixText.length)}${suffixText}`;
                }

                return {
                    id: profile.sub,
                    email,
                    name: profile.name,
                    image: profile.picture,
                    role: "SITE_ENGINEER",
                    username,
                    emailVerified: profile.email_verified ? new Date() : null,
                };
            },
        }),
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                try {
                    if (!credentials?.email || !credentials?.password) {
                        throw new Error("Missing credentials");
                    }

                    const { email, password } = credentials;

                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user || !user.password) {
                        throw new Error("Invalid credentials");
                    }

                    if (!user.emailVerified) {
                        throw new Error("Please verify your email first");
                    }

                    const isPasswordValid = await bcrypt.compare(password, user.password);
                    if (!isPasswordValid) {
                        throw new Error("Invalid credentials");
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        username: user.username ?? "",
                        image: user.image,
                        role: user.role,
                    };
                } catch (error) {
                    console.error("Authorize error:", error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async signIn({ account, profile, user }) {
            try {
                console.log("SignIn callback - Account:", account?.provider);
                console.log("SignIn callback - Profile:", profile);
                console.log("SignIn callback - User:", user);

                // For Google provider, ensure user has username
                if (account?.provider === "google" && user && user.email) {
                    // Check if user already exists in database
                    const existingUser = await prisma.user.findUnique({
                        where: { email: user.email },
                        select: { id: true, username: true },
                    });

                    if (existingUser && !existingUser.username) {
                        const usernameBase =
                            user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) ||
                            "user";
                        let username = usernameBase;
                        let suffix = 1;

                        while (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
                            const suffixText = String(suffix++);
                            username = `${usernameBase.slice(0, 30 - suffixText.length)}${suffixText}`;
                        }

                        await prisma.user.update({
                            where: { id: existingUser.id },
                            data: { username },
                        });
                    }
                }

                return true;
            } catch (error) {
                console.error("SignIn callback error:", error);
                return false;
            }
        },
        async jwt({ token, user, account, trigger, session }) {
            // Initial sign in
            if (account && user) {
                token.id = user.id;
                token.role = user.role;
                token.username = user.username;
                token.provider = account.provider;
                console.log("JWT initial sign in:", { userId: user.id, provider: account.provider });
            }

            // Handle session updates
            if (trigger === "update" && session) {
                if (session.user?.username) {
                    token.username = session.user.username;
                }
                return { ...token, ...session.user };
            }

            // Only refresh user data for authenticated users
            if (token.email) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { email: token.email as string },
                    });

                    if (dbUser) {
                        token.id = dbUser.id;
                        token.role = dbUser.role;
                        token.username = dbUser.username ?? "";
                        token.name = dbUser.name;
                        token.picture = dbUser.image;

                    }
                } catch (error) {
                    console.error("Error refreshing user data in JWT:", error);
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.username = token.username as string;
                session.user.name = token.name as string;
                session.user.image = token.picture as string;

            }

            console.log("Session callback - Session:", session);
            return session;
        },
        async redirect({ url, baseUrl }) {
            // Handle redirects properly
            console.log("Redirect callback:", { url, baseUrl });

            // Allows relative callback URLs
            if (url.startsWith("/")) {
                return `${baseUrl}${url}`;
            }
            // Allows callback URLs on the same origin
            else if (new URL(url).origin === baseUrl) {
                return url;
            }

            // Default to home page
            return baseUrl;
        },
    },
    pages: {
        signIn: "/auth",
        error: "/auth/error", // Create this page
        signOut: "/auth/signout",
    },
    events: {
        async signIn({ user, account }) {
            console.log("User signed in:", {
                user: user?.email,
                provider: account?.provider,
            });
        },
        async createUser({ user }) {
            console.log("User created:", user?.email);
        },
        async linkAccount({ user, account }) {
            console.log("Account linked:", {
                user: user?.email,
                provider: account?.provider,
            });
        },
        async session({ session }) {
            console.log("Session event:", session);
        },
    },
    secret: env.NEXTAUTH_SECRET,
};