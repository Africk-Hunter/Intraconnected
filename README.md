# Intraconnected

Intraconnected is a general-purpose idea tracking tool that helps users organize thoughts, concepts, and hierarchies using a visual, node-based layout. It combines the flexibility of a mind map with the structure of a non-linear document builder, enabling users to explore and manage their ideas intuitively.

## Features

- **Node Creation**: Create nodes (ideas) and link them to a parent or other ideas to build a network of interconnected thoughts.
- **Zoom and Explore**: Click on a node to zoom in and treat it as the current "root," allowing focused exploration of ideas.
- **Tree Navigation**: Navigate back up the hierarchy using the Back button for seamless movement between ideas.
- **Add New Ideas**: Use the plus button on the left to quickly add new ideas and expand your network.

## Building and Running the Project Locally

To build and run the project locally, follow these steps:

1. Clone the repository:
    ```sh
    git clone https://github.com/Africk-Hunter/Intraconnected.git
    ```

2. Install the dependencies:
    ```sh
    npm install
    ```

3. Create a `.env` file in the root directory and add your Firebase configuration:
    ```env
    REACT_APP_FIREBASE_API_KEY=your-api-key
    REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
    REACT_APP_FIREBASE_PROJECT_ID=your-project-id
    REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
    REACT_APP_FIREBASE_APP_ID=your-app-id
    ```

4. Start the development server:
    ```sh
    npm run dev
    ```

5. Open [http://localhost:5173](http://localhost:5173) to view the app in the browser.
