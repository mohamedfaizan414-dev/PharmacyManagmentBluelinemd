import React, { useEffect, useState } from "react";
import "./login.css";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useAuth } from "../../context/AuthContext";
import { useForm } from "react-hook-form";
import ButtonLoader from "../../components/common/buttonLoader/ButtonLoader";
import { toast } from "react-toastify";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  BarChart3,
  Calendar,
  Shield,
} from "lucide-react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const Login = () => {
  useDocumentTitle("Sign in");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, status } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    if (status === "ready" || status === "needs-branch") {
      navigate("/dashboard", { replace: true });
    }
  }, [status, navigate]);

  const handlelogin = async (data) => {
    setIsLoading(true);

    try {
      await signIn(data.email.trim(), data.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.response ||
          err?.message ||
          "Invalid credentials. Please try again."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-bg">
      <div className="login-card-container">
        {/* LEFT PANEL - SIGN IN FORM */}
        <div className="login-left-panel">
          <div>
            {/* Header Brand */}
            <div className="login-brand-header">
              <img src={logo} alt="BluelineMD Logo" className="login-brand-logo" />
              <span className="login-brand-subtitle">Healthcare Admin Portal</span>
            </div>

            <form onSubmit={handleSubmit(handlelogin)} noValidate>
              <h2 className="login-welcome-heading">Welcome back</h2>
              <p className="login-welcome-sub">Sign in to manage your hospital operations.</p>

              {/* Email or Phone field */}
              <div className="login-form-group">
                <label className="login-label">
                  Email or Phone<span>*</span>
                </label>
                <div className="login-input-wrapper">
                  <Mail className="login-input-icon" size={16} />
                  <input
                    type="text"
                    className="login-input"
                    placeholder="your@gmail.com"
                    autoComplete="username"
                    {...register("email", { required: "Email is required" })}
                  />
                </div>
                {errors.email && (
                  <small className="text-danger mt-1 d-block">{errors.email.message}</small>
                )}
              </div>

              {/* Password field */}
              <div className="login-form-group">
                <label className="login-label">
                  Password<span>*</span>
                </label>
                <div className="login-input-wrapper">
                  <Lock className="login-input-icon" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...register("password", { required: "Password is required" })}
                  />
                  <button
                    type="button"
                    className="login-input-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <small className="text-danger mt-1 d-block">{errors.password.message}</small>
                )}
              </div>

              {/* Keep me signed in & Forgot Password */}
              <div className="login-options-row">
                <label className="login-checkbox-label">
                  <input type="checkbox" defaultChecked />
                  Keep me signed in
                </label>
                <Link to="/forgot-password" className="login-forgot-link">
                  Forgot password?
                </Link>
              </div>

              {/* Submit button */}
              <button
                className="login-submit-btn"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? <ButtonLoader label="Signing In..." /> : "Sign in to dashboard"}
              </button>
            </form>
          </div>

          <div>
            {/* Terms & Privacy */}
            <p className="login-terms-text">
              By signing in you agree to our{" "}
              <a href="#terms" onClick={(e) => e.preventDefault()}>
                Terms of Service
              </a>{" "}
              &{" "}
              <a href="#privacy" onClick={(e) => e.preventDefault()}>
                Privacy Policy
              </a>
            </p>

            <p className="login-demo-link">
              New here?{" "}
              <a href="#demo" onClick={(e) => e.preventDefault()}>
                Request a demo &rarr;
              </a>
            </p>

            {/* Circular Down Arrow Button */}
            <div className="login-down-arrow-circle" aria-hidden="true">
              ↓
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - NAVY BLUE BRANDING & FEATURES */}
        <div className="login-right-panel">
          <div>
            <div className="login-right-header">
              <div className="login-right-title-wrap">
                <img src={logo} alt="BluelineMD Icon" className="login-right-logo-icon" />
                <h2 className="login-right-title">Why BluelineMD?</h2>
              </div>
              <div className="login-hipaa-badge">
                <Shield size={12} />
                HIPAA Certified
              </div>
            </div>

            <p className="login-right-desc">
              One secure platform for clinical teams, operations, and leadership.
            </p>

            {/* 4 Feature Cards with specific colored icon boxes */}
            <div className="login-features-list">
              <div className="login-feature-card">
                <div className="login-feature-icon-box icon-blue">
                  <Users size={17} />
                </div>
                <div className="login-feature-info">
                  <h4 className="login-feature-name">Patient management</h4>
                  <p className="login-feature-text">Records, history & appointments unified</p>
                </div>
              </div>

              <div className="login-feature-card">
                <div className="login-feature-icon-box icon-purple">
                  <BarChart3 size={17} />
                </div>
                <div className="login-feature-info">
                  <h4 className="login-feature-name">Analytics & reporting</h4>
                  <p className="login-feature-text">Real-time insights across all departments</p>
                </div>
              </div>

              <div className="login-feature-card">
                <div className="login-feature-icon-box icon-teal">
                  <Calendar size={17} />
                </div>
                <div className="login-feature-info">
                  <h4 className="login-feature-name">Staff scheduling</h4>
                  <p className="login-feature-text">Shifts, rosters & leave at a glance</p>
                </div>
              </div>

              <div className="login-feature-card">
                <div className="login-feature-icon-box icon-gold">
                  <ShieldCheck size={17} />
                </div>
                <div className="login-feature-info">
                  <h4 className="login-feature-name">Enterprise security</h4>
                  <p className="login-feature-text">SSO, 2FA & role-based access</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trusted Stats */}
          <div className="login-trusted-section">
            <div className="login-trusted-label">TRUSTED BY</div>
            <div className="login-stats-grid">
              <div className="login-stat-box">
                <div className="login-stat-number">500+</div>
                <div className="login-stat-text">Hospitals</div>
              </div>
              <div className="login-stat-box">
                <div className="login-stat-number magenta">2M+</div>
                <div className="login-stat-text">Patients</div>
              </div>
              <div className="login-stat-box">
                <div className="login-stat-number green">99.9%</div>
                <div className="login-stat-text">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
