"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();

  const mode = searchParams.get("mode");
  const isRegisterMode = mode === "register" || mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isLogin, setIsLogin] = useState(!isRegisterMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");

  // Validation error states
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    forgotEmail: "",
  });

  const getDashboardHref = (role?: string) => {
    switch (role) {
      case "GENERAL_MANAGER":
        return "/admin";
      case "PROJECT_MANAGER":
        return "/project-manager";
      case "HR_MANAGER":
        return "/hr-manager";
      case "SITE_ENGINEER":
        return "/site-engineer";
      case "PROCUREMENT_OFFICER":
        return "/procurement-officer";
      case "ACCOUNTANT":
        return "/accountant";
      default:
        return "/admin";
    }
  };

  // Validation functions
  const validateName = (value: string): string => {
    if (!value.trim()) return "Name is required";
    if (value.trim().length < 2) return "Name must be at least 2 characters";
    if (value.trim().length > 50) return "Name must be less than 50 characters";
    if (!/^[a-zA-Z\s'-]+$/.test(value))
      return "Name can only contain letters, spaces, hyphens, and apostrophes";
    return "";
  };

  const validateUsername = (value: string): string => {
    if (!value.trim()) return "Username is required";
    if (value.trim().length < 3)
      return "Username must be at least 3 characters";
    if (value.trim().length > 15)
      return "Username must be less than 15 characters";


    if (!/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(value)) {
      return "Username can only contain letters, numbers, and special characters";
    }

    // Check if it contains at least one alphanumeric character (letter or number)
    if (!/[a-zA-Z0-9]/.test(value)) {
      return "Username must contain at least one letter or number";
    }

    // Check if it starts with a letter (optional rule - you can remove if you want)
    // if (!/^[a-zA-Z]/.test(value)) {
    //   return "Username must start with a letter";
    // }

    return "";
  };

  const validateEmail = (value: string): string => {
    if (!value.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    if (value.length > 254) return "Email is too long";
    return "";
  };

  const validatePassword = (value: string): string => {
    if (!value) return "Password is required";

    // Updated password validation:
    // Minimum length: 8 characters
    if (value.length < 8) return "Password must be at least 8 characters";
    if (value.length > 20) return "Password must be less than 20 characters";

    // Password strength checks (only for registration)
    if (!isLogin) {
      // At least one letter (upper or lower)
      if (!/[a-zA-Z]/.test(value))
        return "Password must contain at least one letter";

      // At least one number
      if (!/[0-9]/.test(value))
        return "Password must contain at least one digit";

      // At least one special character
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value))
        return "Password must contain at least one special character";
    }
    return "";
  };

  const validateForgotEmail = (value: string): string => {
    if (!value.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    return "";
  };

  // Real-time validation handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setFieldErrors((prev) => ({ ...prev, name: validateName(value) }));
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setFieldErrors((prev) => ({ ...prev, username: validateUsername(value) }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setFieldErrors((prev) => ({ ...prev, password: validatePassword(value) }));
  };

  const handleForgotEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForgotPasswordEmail(value);
    setFieldErrors((prev) => ({
      ...prev,
      forgotEmail: validateForgotEmail(value),
    }));
  };

  // Form validation before submission
  const validateForm = (): boolean => {
    const errors = {
      name: !isLogin ? validateName(name) : "",
      username: !isLogin ? validateUsername(username) : "",
      email: validateEmail(email),
      password: validatePassword(password),
      forgotEmail: "",
    };

    setFieldErrors(errors);

    // Check if there are any errors
    return !Object.values(errors).some((error) => error !== "");
  };

  // Handle verification success/failure messages
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const verified = searchParams.get("verified");
    const verificationError = searchParams.get("error");
    const verifiedEmail = searchParams.get("email");

    if (verified === "true") {
      setSuccess(
        `Email verified successfully! You can now log in${verifiedEmail ? ` with ${verifiedEmail}` : ""}.`,
      );
      setIsLogin(true);
      if (verifiedEmail) {
        setEmail(verifiedEmail);
      }
    } else if (verified === "false" && verificationError) {
      setError(decodeURIComponent(verificationError));
    }
  }, [searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(getDashboardHref(session.user?.role));
    }
  }, [router, session, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      setError("Please fix the errors in the form");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (isLogin) {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          if (result.error === "CredentialsSignin") {
            setError(
              "Login failed. Please check your email and password. If you just registered, please verify your email first.",
            );
          } else {
            setError("Login failed: " + result.error);
          }
        } else {
          console.log("Login successful, updating session...");
          await update();
        }
      } else {
        // Check username availability before submitting
        const usernameCheck = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(username)}`,
        );
        const usernameData = await usernameCheck.json();

        if (!usernameData.available) {
          setFieldErrors((prev) => ({
            ...prev,
            username: "Username is already taken",
          }));
          setError("Username is already taken");
          setLoading(false);
          return;
        }

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            name,
            username,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess(
            "Registration successful! Please check your email to verify your account.",
          );
          if (data.data?.verificationToken) {
            setSuccess(
              data.message +
              ` (Dev: Click here to verify: /api/auth/verify-email?token=${data.data.verificationToken})`,
            );
          }
          setPassword("");
          setName("");
          setUsername("");
        } else {
          if (data.error?.includes("email")) {
            setFieldErrors((prev) => ({ ...prev, email: data.error }));
          } else if (data.error?.includes("username")) {
            setFieldErrors((prev) => ({ ...prev, username: data.error }));
          } else {
            setError(data.error || "Registration failed");
          }
        }
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signIn("google", { callbackUrl: "/auth" });
    } catch {
      setError("Google login failed");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate forgot password email
    const forgotEmailError = validateForgotEmail(forgotPasswordEmail);
    if (forgotEmailError) {
      setFieldErrors((prev) => ({ ...prev, forgotEmail: forgotEmailError }));
      setError(forgotEmailError);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotPasswordEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(
          "Password reset link has been sent to your email. Please check your inbox and follow the instructions.",
        );
        setShowForgotPassword(false);
        setForgotPasswordEmail("");
        setFieldErrors((prev) => ({ ...prev, forgotEmail: "" }));
      } else {
        setError(data.error || "Failed to send password reset email.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Forgot password error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
      }}
    >
      {/* Auth Form Container */}
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "40px 32px",
            width: "100%",
            maxWidth: "450px",
            color: "#1f2937",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          }}
        >
          {/* Title */}
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              marginBottom: "28px",
              color: "#1f2937",
              textAlign: "center",
            }}
          >
            {isLogin ? "Sign In" : "Sign Up"}
          </h1>

          {/* Error/Success Messages */}
          {error && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#ef4444",
                padding: "12px 20px",
                borderRadius: "12px",
                marginBottom: "16px",
                fontSize: "14px",
                backdropFilter: "blur(10px)",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#10b981",
                padding: "12px 20px",
                borderRadius: "12px",
                marginBottom: "16px",
                fontSize: "14px",
                backdropFilter: "blur(10px)",
              }}
            >
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                {/* Name Field */}
                <div style={{ marginBottom: "16px" }}>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={handleNameChange}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: "16px",
                      backgroundColor: "#ffffff",
                      border: `1px solid ${fieldErrors.name ? "#ef4444" : "#d1d5db"}`,
                      borderRadius: "6px",
                      color: "#374151",
                      outline: "none",
                    }}
                    required
                    disabled={loading}
                  />
                  {fieldErrors.name && (
                    <div
                      style={{
                        color: "#ef4444",
                        fontSize: "12px",
                        marginTop: "4px",
                        paddingLeft: "4px",
                      }}
                    >
                      {fieldErrors.name}
                    </div>
                  )}
                </div>

                {/* Username Field */}
                <div style={{ marginBottom: "16px" }}>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={handleUsernameChange}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: "16px",
                      backgroundColor: "#ffffff",
                      border: `1px solid ${fieldErrors.username ? "#ef4444" : "#d1d5db"}`,
                      borderRadius: "6px",
                      color: "#374151",
                      outline: "none",
                    }}
                    required
                    disabled={loading}
                  />
                  {fieldErrors.username && (
                    <div
                      style={{
                        color: "#ef4444",
                        fontSize: "12px",
                        marginTop: "4px",
                        paddingLeft: "4px",
                      }}
                    >
                      {fieldErrors.username}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Email Field */}
            <div style={{ marginBottom: "16px" }}>
              <input
                type="email"
                placeholder="Email or phone number"
                value={email}
                onChange={handleEmailChange}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: "16px",
                  backgroundColor: "#ffffff",
                  border: `1px solid ${fieldErrors.email ? "#ef4444" : "#d1d5db"}`,
                  borderRadius: "6px",
                  color: "#374151",
                  outline: "none",
                }}
                required
                disabled={loading}
              />
              {fieldErrors.email && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "12px",
                    marginTop: "4px",
                    paddingLeft: "4px",
                  }}
                >
                  {fieldErrors.email}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: "16px" }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={handlePasswordChange}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: "16px",
                  backgroundColor: "#ffffff",
                  border: `1px solid ${fieldErrors.password ? "#ef4444" : "#d1d5db"}`,
                  borderRadius: "6px",
                  color: "#374151",
                  outline: "none",
                }}
                required
                disabled={loading}
              />
              {fieldErrors.password && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "12px",
                    marginTop: "4px",
                    paddingLeft: "4px",
                  }}
                >
                  {fieldErrors.password}
                </div>
              )}

              {/* Password strength indicator (for registration) */}
              {!isLogin && password && !fieldErrors.password && (
                <div
                  style={{
                    marginTop: "8px",
                    padding: "8px",
                    background: "#f3f4f6",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ marginBottom: "4px", color: "#374151" }}>
                    Password strength:
                  </div>
                  <div
                    style={{
                      height: "4px",
                      background: "#e5e7eb",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, (password.length / 12) * 100)}%`,
                        height: "100%",
                        background: (() => {
                          const hasLetter = /[a-zA-Z]/.test(password);
                          const hasNumber = /[0-9]/.test(password);
                          const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
                          const criteriaCount = [hasLetter, hasNumber, hasSpecial, password.length >= 8].filter(Boolean).length;

                          if (criteriaCount >= 4) return "#10b981"; // Strong
                          if (criteriaCount >= 3) return "#f59e0b"; // Medium
                          if (criteriaCount >= 2) return "#f97316"; // Weak
                          return "#ef4444"; // Very Weak
                        })(),
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      color: "#6b7280",
                      fontSize: "11px",
                    }}
                  >
                    Password must be at least 8 characters with at least one letter,
                    number, and special character
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "16px",
                fontWeight: "600",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                marginTop: "16px",
                marginBottom: "12px",
                transition: "background-color 0.2s ease",
              }}
              disabled={loading}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#1d4ed8";
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#3b82f6";
                }
              }}
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </button>

            {/* Forgot Password Link */}
            {isLogin && (
              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <button
                  onClick={() => {
                    setShowForgotPassword(true);
                    setForgotPasswordEmail(email);
                    setError("");
                    setSuccess("");
                    setFieldErrors({
                      name: "",
                      username: "",
                      email: "",
                      password: "",
                      forgotEmail: "",
                    });
                  }}
                  style={{
                    color: "#6b7280",
                    textDecoration: "none",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                  disabled={loading}
                >
                  Forgot your password?
                </button>
              </div>
            )}
          </form>

          {/* Toggle Form */}
          <div
            style={{ marginTop: "16px", fontSize: "16px", color: "#6b7280" }}
          >
            {isLogin ? "New to Construction System? " : "Already have an account? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setSuccess("");
                setEmail("");
                setPassword("");
                setName("");
                setUsername("");
                setFieldErrors({
                  name: "",
                  username: "",
                  email: "",
                  password: "",
                  forgotEmail: "",
                });
              }}
              style={{
                color: "#3b82f6",
                textDecoration: "none",
                cursor: "pointer",
                background: "none",
                border: "none",
                fontSize: "16px",
                fontWeight: "500",
              }}
              disabled={loading}
            >
              {isLogin ? "Sign up now" : "Sign in"}
            </button>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              margin: "24px 0",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background:
                  "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
              }}
            ></div>
            <span
              style={{ padding: "0 16px", color: "#9ca3af", fontSize: "14px" }}
            >
              OR
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background:
                  "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
              }}
            ></div>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              backgroundColor: "#4285f4",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background-color 0.2s ease",
            }}
            disabled={loading}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#3367d6";
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "#4285f4";
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="white"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="white"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="white"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="white"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Forgot Password Modal */}
          {showForgotPassword && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px",
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "16px",
                  padding: "32px",
                  maxWidth: "400px",
                  width: "100%",
                  boxShadow:
                    "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
              >
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    marginBottom: "16px",
                    color: "#1f2937",
                    textAlign: "center",
                  }}
                >
                  Reset Password
                </h3>
                <p
                  style={{
                    fontSize: "16px",
                    color: "#6b7280",
                    marginBottom: "24px",
                    textAlign: "center",
                  }}
                >
                  Enter your email address and we&apos;ll send you a link to reset
                  your password.
                </p>

                <form onSubmit={handleForgotPassword}>
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "6px",
                      }}
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={handleForgotEmailChange}
                      required
                      style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: "16px",
                        border: `1px solid ${fieldErrors.forgotEmail ? "#ef4444" : "#d1d5db"}`,
                        borderRadius: "8px",
                        outline: "none",
                        transition: "border-color 0.2s ease",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                      onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
                      placeholder="Enter your email"
                    />
                    {fieldErrors.forgotEmail && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "12px",
                          marginTop: "4px",
                          paddingLeft: "4px",
                        }}
                      >
                        {fieldErrors.forgotEmail}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotPasswordEmail("");
                        setError("");
                        setFieldErrors((prev) => ({
                          ...prev,
                          forgotEmail: "",
                        }));
                      }}
                      style={{
                        padding: "12px 20px",
                        fontSize: "14px",
                        fontWeight: "600",
                        backgroundColor: "#f3f4f6",
                        color: "#374151",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: "12px 20px",
                        fontSize: "14px",
                        fontWeight: "600",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1,
                        transition: "background-color 0.2s ease",
                      }}
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Back to Home */}
          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <button
              onClick={() => router.push("/")}
              style={{
                color: "#9ca3af",
                background: "none",
                border: "none",
                fontSize: "13px",
                cursor: "pointer",
                transition: "color 0.3s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#374151")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#9ca3af")}
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1f2937",
            fontSize: "18px",
          }}
        >
          Loading...
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}