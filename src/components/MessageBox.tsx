import { useIdeaContext } from "../context/IdeaContext";

function MessageBox() {

    const { messageBoxMessage, messageType } = useIdeaContext();

    return (
        <section className={`messageBox shadowAndBorder neobrutal-button ${messageType}`}>
            <p className="messageBoxMessage">{messageBoxMessage}</p>
        </section>
    )
}

export default MessageBox;