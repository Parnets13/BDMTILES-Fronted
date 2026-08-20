import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserOutlined, LockOutlined, EyeOutlined, EyeInvisibleOutlined, ExclamationCircleOutlined, LoadingOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await login(formData.email, formData.password);
      if (!result.success) {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          {/* Top line */}
          <div className="h-[3px] w-full bg-gradient-to-r from-[#FF5F03] via-[#ff8534] to-[#FF5F03]" />

          <div className="px-8 pt-7 pb-7">
            {/* Logo */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-3">
                <div className="bg-white rounded-xl p-2.5 shadow-md border border-gray-100">
                  <img src="/logo.jpeg" alt="BDMTILES" className="w-14 h-14 object-contain" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#FF5F03] rounded-full p-[3px] shadow-sm">
                  <SafetyCertificateOutlined className="text-white text-[10px]" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-gray-900">BDMTILES</h1>
              <p className="text-gray-400 text-xs mt-0.5">Tiles, Granite, Marble & Building Materials</p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="mb-4 bg-red-50 border border-red-100 text-red-600 px-3 py-2.5 rounded-lg flex items-center gap-2 text-xs"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <ExclamationCircleOutlined className="shrink-0 text-sm" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center">
                    <UserOutlined className={`text-[15px] ${focused === 'email' ? 'text-[#FF5F03]' : 'text-gray-400'}`} />
                  </span>
                  <input
                    name="email" type="text" required autoComplete="username"
                    className="w-full h-[42px] pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 transition-colors focus:outline-none focus:bg-white focus:border-[#FF5F03] focus:ring-1 focus:ring-[#FF5F03]/20"
                    placeholder="Enter email or username"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center">
                    <LockOutlined className={`text-[15px] ${focused === 'password' ? 'text-[#FF5F03]' : 'text-gray-400'}`} />
                  </span>
                  <input
                    name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
                    className="w-full h-[42px] pl-9 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 transition-colors focus:outline-none focus:bg-white focus:border-[#FF5F03] focus:ring-1 focus:ring-[#FF5F03]/20"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    disabled={loading}
                  />
                  <span
                    className="absolute inset-y-0 right-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeInvisibleOutlined className="text-[15px]" /> : <EyeOutlined className="text-[15px]" />}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !formData.email || !formData.password}
                className="w-full h-[42px] rounded-lg font-semibold text-white text-sm bg-[#FF5F03] hover:bg-[#e65500] active:bg-[#cc4b00] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md shadow-[#FF5F03]/15"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingOutlined className="text-sm" />
                    Signing in...
                  </span>
                ) : 'Sign in to Portal'}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 h-px bg-gray-100" />

            {/* Quick Access */}
            <div>
              <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest mb-2.5 font-semibold">
                Quick Access
              </p>
              <button
                type="button"
                onClick={() => { setFormData({ email: 'superadmin@bdmtiles.com', password: 'superadmin123' }); setError(''); }}
                className="w-full text-left px-4 py-2.5 bg-gray-50 hover:bg-orange-50/50 border border-gray-100 hover:border-[#FF5F03]/20 rounded-lg transition-colors group"
                disabled={loading}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-gray-800 text-[13px] group-hover:text-[#FF5F03] transition-colors">Super Admin</span>
                    <div className="text-[11px] text-gray-400 mt-0.5">superadmin@bdmtiles.com</div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-gray-200 text-gray-400 group-hover:text-[#FF5F03] group-hover:border-[#FF5F03]/20 transition-colors">
                    Fill
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-400 text-[10px] mt-5">
          © {new Date().getFullYear()} BDM GRANIMARMO PRIVATE LIMITED · All rights reserved
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
