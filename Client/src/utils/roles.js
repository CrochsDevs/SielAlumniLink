export const Roles = Object.freeze({
  STUDENT: 'student',
  ALUMNI: 'alumni',
  ADMIN: 'admin',
});

export const hasRole = (user, ...allowedRoles) =>
  !!user?.role && allowedRoles.includes(user.role);

export const isAdmin = (user) => user?.role === Roles.ADMIN;
