
import { verifySessionToken, sessionMatches } from '../modules/auth/session-token.js';
import AuthModel from '../modules/auth/auth.models.js';

export const optionalProtect = async (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = verifySessionToken(token);
        const user = await AuthModel.findById(decoded.sub);

        req.user = sessionMatches(decoded, user) ? user : null;
        next();
    } catch {
        req.user = null;
        next();
    }
};

export const protect = async (req, res, next) => {
    try {
        let token;

        // Get token from cookie
        if (req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        const decoded = verifySessionToken(token);
        const user = await AuthModel.findById(decoded.sub);

        if (!sessionMatches(decoded, user)) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

// Role-based guard. Use after `protect`:
//   router.delete('/:id', protect, authorize(Roles.ADMIN), deleteUser);
export const authorize = (...allowedRoles) => {
    const allowed = allowedRoles.map((role) => String(role).toLowerCase());

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        // Case-normalized compare so 'Admin' / 'ADMIN' in old records
        // still match Roles ('admin').
        if (!allowed.includes(String(req.user.role || '').toLowerCase())) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: your role cannot access this resource'
            });
        }

        next();
    };
};
