import React, { useEffect, useState } from "react";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import AuthOptionMessage from "./AuthOptionMessage";

const Auth: React.FC = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [messageBoxMessage, setMessageBoxMessage] = useState("");
    const [messageType, setMessageType] = useState("");

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                window.location.href = '/';
            }
        });
        return () => unsubscribe();
    });

    // Function to display messages in the message box
    function displayMessage(message: string, type: string) {
        setMessageBoxMessage(message);
        setMessageType(type);

        setTimeout(() => {
            setMessageBoxMessage("");
            setMessageType("");
        }, 3000);
    }

    // Function to check password length and complexity
    function checkPassword(password: string) {
        if (password.length < 6) {
            displayMessage("Password must be at least 6 characters long", "bad");
            console.log(messageBoxMessage)
            return false;
        } else if (password.length > 20) {
            displayMessage("Password must be less than 20 characters long", "bad");
            console.log(messageBoxMessage)
            return false;
        }
        setMessageBoxMessage("");
        return true;
    }

    // Function to handle sign up
    function defaultSignUp(e: React.MouseEvent<HTMLButtonElement>): void {
        e.preventDefault();
        if (password !== confirmPassword) {
            displayMessage("Passwords do not match", "bad");
            console.log(messageBoxMessage)
            return;
        }
        if (checkPassword(password)) {
            handleSignUp();
            return;
        }
        console.log('Password did not meet requirements.');
    }

    // Function to handle sign up with Firebase
    function handleSignUp() {
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log(user);
                displayMessage("Successfully created account!", "good");
                setEmail("");
                setPassword("");
            })
            .catch((error) => {
                const errorMessage = error.message;
                console.log(errorMessage);
            });
    }

    // Function to handle sign in with Firebase
    function handleSignIn(e: React.MouseEvent<HTMLButtonElement>): void {
        e.preventDefault();
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                window.location.href = '/';
            })
            .catch((error) => {
                const errorMessage = error.message;
                displayMessage('Invalid email or password. Please try again', 'bad');
                console.log('Invalid email or password. Please try again')
                console.log(errorMessage);
            });
    }

    interface MessageBoxProps {
        messageBoxMessage: string;
        goodOrBad: string;
    }

    function MessageBox({ messageBoxMessage, goodOrBad }: MessageBoxProps) {
        return (
            <section className={`messageBox shadowAndBorder neobrutal-button ${goodOrBad}`}>
                <p className="messageBoxMessage">{messageBoxMessage}</p>
            </section>
        )
    }

    return (
        <div className="auth">
            <MessageBox messageBoxMessage={messageBoxMessage} goodOrBad={messageType} />

            <div className="largeLogo"><img src="/images/MainLargerLogo.svg" alt="" className="largeLogoImg" /></div>
            <section className="authForm">
                <section className="authInputs">
                    <input type="text" className="input neobrutal-nonbutton" placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="password" className="input neobrutal-nonbutton" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <input type="password" className={`input neobrutal-nonbutton confirmPassword ${showConfirmPassword ? "visible" : "hidden"}`} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </section>
                <button
                    className={`authSubmit neobrutal-button ${showConfirmPassword ? "register" : "login"}`}
                    onClick={(e) => {
                        e.preventDefault();
                        if (!showConfirmPassword) {
                            handleSignIn(e);
                        } else if (showConfirmPassword) {
                            defaultSignUp(e);
                        }
                    }}>
                    Continue
                </button>
                <AuthOptionMessage showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} />
            </section>
        </div>
    );
};

export default Auth;
