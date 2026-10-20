import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/axios';

const ForgetPassword = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const response = await api.post('/auth/forgot-password', { email });
            if (response.data.success) {
                setMessage('OTP sent to your email! Valid for 10 minutes.');
                setStep(2);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const response = await api.post('/auth/verify-otp', { email, otp });
            if (response.data.success) {
                setResetToken(response.data.data.resetToken);
                setMessage('OTP verified! Create your new password.');
                setStep(3);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        try {
            const response = await api.post('/auth/reset-password', { token: resetToken, newPassword });
            if (response.data.success) {
                setMessage('Password reset successful! Redirecting to login...');
                setTimeout(() => navigate('/login'), 2000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Reset failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-yellow-500 to-orange-600">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
                    {step === 1 && 'Forgot Password?'}
                    {step === 2 && 'Enter OTP'}
                    {step === 3 && 'Create New Password'}
                </h1>
                {message && <div className="bg-green-100 text-brand p-3 rounded mb-4">{message}</div>}
                {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
                
                {step === 1 && (
                    <form onSubmit={handleSendOTP} className="space-y-5">
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                placeholder="Enter your registered email"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50"
                        >
                            {loading ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                    </form>
                )}
                
                {step === 2 && (
                    <form onSubmit={handleVerifyOTP} className="space-y-5">
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full px-4 py-3 border bg-gray-100 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">OTP Code</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                maxLength={6}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-yellow-500"
                                placeholder="Enter 6-digit OTP"
                            />
                            <p className="text-sm text-gray-500 mt-1">Check your email for the OTP</p>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                    </form>
                )}
                
                {step === 3 && (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                placeholder="Enter new password"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                placeholder="Confirm new password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50"
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                )}
                
                <p className="text-center text-gray-600 mt-6">
                    Remember your password? <Link to="/login" className="text-yellow-600 font-semibold">Back to Login</Link>
                </p>
            </div>
        </div>
    );
};

export default ForgetPassword;