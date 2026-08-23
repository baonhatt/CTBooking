import { Navigate } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
}

/**
 * Client-side route guard - Check localStorage for userToken
 * Sử dụng cho các trang client cần login (ví dụ: /account)
 * Chỉ check localStorage, không gọi API (nhanh)
 */
export default function ProtectedRoute({ children }: Props) {
  const token = localStorage.getItem('userToken');
<<<<<<< HEAD
  
=======

>>>>>>> preview
  // Check login
  if (!token) {
    return <Navigate to="/login" replace />;
  }
<<<<<<< HEAD
  
=======

>>>>>>> preview
  return <>{children}</>;
}
