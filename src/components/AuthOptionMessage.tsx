import React from 'react';

interface AuthOptionMessageProps {
    showConfirmPassword: boolean;
    setShowConfirmPassword: (ShowConfirmPassword: boolean) => void;
}

const AuthOptionMessage: React.FC<AuthOptionMessageProps> = ({ showConfirmPassword, setShowConfirmPassword }) => {
    const toggle = () => setShowConfirmPassword(!showConfirmPassword);
    const toggleProps = {
        role: "button",
        tabIndex: 0,
        onClick: toggle,
        onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
            }
        },
    };
    return (
        <>
            {showConfirmPassword ? (
                <p className={`switchAuth ${showConfirmPassword ? "register" : "login"}`}>Already have an account? <span className="switchAuthButton" {...toggleProps}>Sign In</span></p>
            ) : (
                <p className={`switchAuth ${showConfirmPassword ? "register" : "login"}`}>Don't have an account yet? <span className="switchAuthButton" {...toggleProps}>Sign Up</span></p>
            )}
        </>
    );
};

export default AuthOptionMessage;
