import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

// TEMPORARY placeholder — papalitan ng totoong student pages.
// TODO(student): build real student dashboard here.
const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Student Portal</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">Welcome, {user?.name || user?.email}!</span>
          {user?.role && (
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-[#007a2e] border border-emerald-200 px-2 py-1 rounded-full">
              {user.role}
            </span>
          )}
          <button
            onClick={() => navigate('/logout')}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </div>
      <p className="text-gray-500">Student pages coming soon.</p>
    </div>
  );
};

export default StudentDashboard;
