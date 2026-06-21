import { useEffect } from 'react';
import Auth from '../components/Auth'

function Login() {
  useEffect(() => {
    document.title = 'Intraconnected — Private Mind Mapping';
  }, []);

  return (
    <Auth />
  );
}

export default Login;