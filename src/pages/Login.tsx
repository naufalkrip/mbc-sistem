import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, Clock, RotateCw, Hash } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import logoImg from "../aset/logo.png";

export function Login() {
  const { login, isAuthenticated, sessionNotice, clearSessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Captcha Angka State
  const [captchaCode, setCaptchaCode] = useState<string>("");
  const [captchaInput, setCaptchaInput] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const redirectNotice =
    (location.state as { message?: string; sessionExpired?: boolean })?.message || sessionNotice;

  // Jika sudah terautentikasi, selalu arahkan ke Dashboard (/)
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Fungsi menggambar visual captcha angka di atas canvas
  const drawCaptcha = useCallback((code: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Bersihkan canvas
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#f8fafc");
    bgGrad.addColorStop(1, "#f1f5f9");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Garis gangguan acak (noise lines)
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = [
        "rgba(185, 28, 28, 0.25)",
        "rgba(30, 64, 175, 0.25)",
        "rgba(100, 116, 139, 0.3)",
      ][i % 3];
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.bezierCurveTo(
        Math.random() * width,
        Math.random() * height,
        Math.random() * width,
        Math.random() * height,
        Math.random() * width,
        Math.random() * height
      );
      ctx.stroke();
    }

    // Titik-titik acak (noise dots)
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = [
        "rgba(185, 28, 28, 0.35)",
        "rgba(15, 23, 42, 0.3)",
        "rgba(2, 132, 199, 0.35)",
      ][i % 3];
      ctx.beginPath();
      ctx.arc(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 1.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Gambar digit angka
    const colors = ["#991b1b", "#1e40af", "#0f766e", "#374151", "#7c2d12"];
    const charSpacing = (width - 32) / (code.length + 1);

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const color = colors[(i + Math.floor(Math.random() * colors.length)) % colors.length];
      const angle = (Math.random() - 0.5) * 0.35; // Rotasi kemiringan angka

      ctx.save();
      const x = 12 + (i + 0.6) * charSpacing;
      const y = height / 2 + 7 + (Math.random() * 4 - 2);

      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.font = "bold 22px 'Poppins', monospace, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  }, []);

  // Fungsi generate kode captcha angka 4 digit baru
  const refreshCaptcha = useCallback(() => {
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(newCode);
    setCaptchaInput("");
    setTimeout(() => {
      drawCaptcha(newCode);
    }, 10);
  }, [drawCaptcha]);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearSessionNotice();

    const cleanUser = username.trim();
    const cleanPass = password.trim();
    const cleanCaptcha = captchaInput.trim();

    if (!cleanUser || !cleanPass) {
      setError("Silakan masukkan username dan password Anda.");
      return;
    }

    if (!cleanCaptcha) {
      setError("Silakan masukkan 4 angka kode captcha.");
      return;
    }

    if (cleanCaptcha !== captchaCode) {
      setError("Kode captcha angka salah. Silakan ketik angka yang baru.");
      refreshCaptcha();
      return;
    }

    setIsSubmitting(true);
    try {
      await login(cleanUser, cleanPass);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal masuk ke sistem. Silakan coba lagi.";
      setError(msg);
      refreshCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card-wrapper">
        {/* Top Brand Header */}
        <div className="login-header">
          <div className="login-logo-container">
            <img src={logoImg} alt="Logo mbc sistem" className="login-logo-img" />
          </div>
          <div className="login-badge">
            <ShieldCheck size={13} />
            Portal Manajemen Internal
          </div>
          <h1 className="login-title">MB CHONDRO</h1>
          <p className="login-subtitle">
            Sistem Informasi Manajemen Terpadu Organisasi
          </p>
        </div>

        {/* Session Inactivity Timeout Notice */}
        {redirectNotice && !error && (
          <div className="login-warning-alert animate-fadeIn">
            <Clock size={18} className="login-warning-icon" />
            <div className="login-warning-text">{redirectNotice}</div>
          </div>
        )}

        {/* Error Alert Toast */}
        {error && (
          <div className="login-error-alert animate-shake">
            <AlertCircle size={18} className="login-error-icon" />
            <div className="login-error-text">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <label htmlFor="username" className="login-label">
              Username
            </label>
            <div className="login-input-wrapper">
              <div className="login-input-icon">
                <User size={18} />
              </div>
              <input
                id="username"
                type="text"
                className="login-input"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                  if (sessionNotice) clearSessionNotice();
                }}
                disabled={isSubmitting}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="login-input-group">
            <label htmlFor="password" className="login-label">
              Password
            </label>
            <div className="login-input-wrapper">
              <div className="login-input-icon">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="login-input"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                  if (sessionNotice) clearSessionNotice();
                }}
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Captcha Angka */}
          <div className="login-input-group">
            <label htmlFor="captcha" className="login-label">
              Kode Keamanan (Captcha Angka)
            </label>
            <div className="login-captcha-row">
              <div
                className="login-captcha-display"
                onClick={refreshCaptcha}
                title="Klik untuk ganti angka captcha"
              >
                <canvas
                  ref={canvasRef}
                  width={125}
                  height={44}
                  className="login-captcha-canvas"
                />
                <button
                  type="button"
                  className="login-captcha-refresh-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshCaptcha();
                  }}
                  title="Muat ulang kode angka"
                  aria-label="Muat ulang captcha"
                >
                  <RotateCw size={14} />
                </button>
              </div>

              <div className="login-input-wrapper login-captcha-input-wrapper">
                <div className="login-input-icon">
                  <Hash size={18} />
                </div>
                <input
                  id="captcha"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  className="login-input login-captcha-input"
                  placeholder="Ketik 4 angka"
                  value={captchaInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setCaptchaInput(val);
                    if (error) setError(null);
                    if (sessionNotice) clearSessionNotice();
                  }}
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="login-btn-loading">
                <span className="login-spinner" />
                Memverifikasi...
              </span>
            ) : (
              <span className="login-btn-content">
                <LogIn size={18} />
                Masuk ke Sistem
              </span>
            )}
          </button>
        </form>

        {/* Footer Brand Info */}
        <div className="login-copyright">
          &copy; {new Date().getFullYear()} Chondro Wonopringgo. All rights reserved.
        </div>
      </div>
    </div>
  );
}


