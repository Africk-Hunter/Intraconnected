import React, { useEffect, useState } from "react";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth";
import AuthOptionMessage from "./AuthOptionMessage";
import MessageBox from "./MessageBox";
import { useIdeaContext } from "../context/IdeaContext";

const Auth: React.FC = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { setMessageBoxMessage, setMessageType, messageBoxMessage } = useIdeaContext();

    useEffect(() => {
        setPersistence(auth, browserLocalPersistence).catch((error) => {
            console.error("Error setting persistence:", error);
        });

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                console.log("Current user: ", auth.currentUser);
                window.location.href = '/main';
            }
        });
        return () => unsubscribe();
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (!showConfirmPassword) {
                    handleSignIn(new MouseEvent("click") as unknown as React.MouseEvent<HTMLButtonElement>);
                } else {
                    defaultSignUp(new MouseEvent("click") as unknown as React.MouseEvent<HTMLButtonElement>);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [showConfirmPassword, email, password, confirmPassword]);

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
        } else if (/\s/.test(password)) {
            displayMessage("Password cannot contain spaces", "bad");
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
        createUserWithEmailAndPassword(auth, email.trim(), password)
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
                window.location.href = '/main';
            })
            .catch((error) => {
                const errorMessage = error.message;
                displayMessage('Invalid email or password. Please try again', 'bad');
                console.log('Invalid email or password. Please try again')
                console.log(errorMessage);
            });
    }

    return (
        <div className="auth">
            <MessageBox />

            <div className="largeLogo"><img src="/images/MainLargerLogo.svg" alt="" className="largeLogoImg" /></div>
            <section className="authForm">
                <section className="authInputs">
                    <input type="text" className="input neobrutal-input" placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="password" className="input neobrutal-input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <input type="password" className={`input neobrutal-input confirmPassword ${showConfirmPassword ? "visible" : "hidden"}`} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
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
