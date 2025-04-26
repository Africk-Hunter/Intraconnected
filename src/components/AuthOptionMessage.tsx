import React from "react";

interface AuthOptionMessageProps {
    showConfirmPassword: boolean;
    setShowConfirmPassword: (ShowConfirmPassword: boolean) => void;
}

const AuthOptionMessage: React.FC<AuthOptionMessageProps> = ({ showConfirmPassword, setShowConfirmPassword }) => {
    return (
        <>
            {showConfirmPassword ? (
                <p className={`switchAuth ${showConfirmPassword ? "register" : "login"}`}>Already have an account? <span className="switchAuthButton" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>Sign In</span></p>
            ) : (
                <p className={`switchAuth ${showConfirmPassword ? "register" : "login"}`}>Don't have an account yet? <span className="switchAuthButton" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>Sign Up</span></p>
            )}
        </>

    );
};

export default AuthOptionMessage;