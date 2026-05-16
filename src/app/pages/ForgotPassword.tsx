import { useState } from "react";
import { Link } from "react-router";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import BrandLogo from "../components/BrandLogo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full -translate-x-48 -translate-y-48 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full translate-x-48 translate-y-48 blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          {/* PNG badge — large white card floating on dark gradient */}
          <BrandLogo
            variant="mark"
            className="w-28 h-28 shadow-2xl shadow-slate-950/60 ring-2 ring-white/20"
          />
          <div className="text-center">
            <p className="text-white font-extrabold text-xl tracking-tight leading-none">TaxSync</p>
            <p className="text-blue-300/80 text-xs font-medium mt-0.5 tracking-wide">Property Tax System</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          {!submitted ? (
            <div className="p-8">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-slate-900">Reset Password</h2>
                </div>
                <p className="text-sm text-slate-500 mt-2 ml-0.5">
                  Enter your registered email address and we'll send you a secure link to reset your password.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your registered email"
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending reset link...
                    </>
                  ) : (
                    "Send Password Reset Link"
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
              </div>
              <h2 className="text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 mb-2">
                If a matching account exists, reset instructions will be sent to:
              </p>
              <p className="text-sm font-medium text-blue-700 bg-blue-50 px-4 py-2 rounded-lg inline-block mb-6">
                {email}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-left mb-6">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Password reset delivery depends on the configured backend notification service. Contact your system administrator if you do not receive an email.
                </p>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm text-slate-500 hover:text-slate-700 underline mr-4"
              >
                Resend email
              </button>
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Back to Login →
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 TaxSync · Authorized Users Only
        </p>
      </div>
    </div>
  );
}
