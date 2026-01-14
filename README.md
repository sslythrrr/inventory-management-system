# Inventas

A comprehensive web-based inventory management system designed to manage inventory, sales, auctions, and related business operations. It provides a multi-user environment with multiple roles (Admin, Manager) for efficient management. It features **Helena**, a Groq-based chatbot.

---

## Key Features

* **Dashboard**: An overview of key inventory and sales metrics.
* **Item Management (Barang)**: Add, edit, delete, and track inventory items, including image uploads.
* **Sales Management (Penjualan)**: Process and record sales transactions.
* **Auction Management (Lelang)**: Manage item auctions, with a separate approval process for superiors (Atasan).
* **User Management**:
    * **Employee (Karyawan)**: Manage employee records.
    * **Owner (Pemilik)**: Manage owner/supplier information.
    * **Superior (Atasan)**: Manage superior accounts for approvals.
* **Authentication**: Secure login and session management for Admins and Superiors (`bcryptjs` for password hashing).
* **Reporting (Laporan)**: Generate reports, with export options likely using `pdfkit` and `exceljs`.
* **Real-time Notifications**: In-app notifications (using `socket.io`) for important events.
* **AI Chatbot**: An integrated chatbot (powered by the Groq API) for assistance.
* **Activity Logging (Log Admin)**: Tracks actions performed by administrators.
* **Profile Management (Profil)**: Allows users to manage their own profiles.

---

## Technologies Used

* **Backend**: Node.js, Express.js
* **Database**: MySQL (using `mysql2` driver)
* **Templating Engine**: EJS (Embedded JavaScript templates)
* **Frontend**: HTML, CSS, JavaScript, Bootstrap, Chart.js
* **Key Node.js Modules**:
    * `express`: Web server framework
    * `mysql2`: Database connection
    * `express-session`: Session management
    * `bcryptjs`: Password hashing
    * `multer` & `sharp`: File upload and image processing
    * `socket.io`: Real-time communication for notifications
    * `pdfkit` & `exceljs`: PDF and Excel report generation
    * `dotenv`: Environment variable management
    * `groq-sdk`: Groq API SDK for AI chatbot
    * `nodemon`: Development server utility

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:

* **Node.js**: (Recommended: LTS version) - Download from [nodejs.org](https://nodejs.org/)
* **npm**: Node Package Manager (comes bundled with Node.js)
* **MySQL Server**: A running instance of a MySQL database.

---

## Installation and Setup

1.  **Clone the repository**:
    ```bash
    git clone [https://github.com/your-username/inventas-inventory-management.git](https://github.com/your-username/inventas-inventory-management.git)
    cd inventas-inventory-management
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    * Create a `.env` file in the root project directory.
    * Add the necessary configuration based on your local setup.
        ```env
        # Database Configuration (from db.js)
        DB_HOST=localhost
        DB_USER=root
        DB_PASSWORD=your_db_password
        DB_NAME=dbinventas
        
        # Chatbot API Key (from .env sample)
        Groq_API_KEY=your_Groq_api_key_here
        ```

4.  **Database Setup**:
    * Ensure your MySQL server is running.
    * Create the database specified in your `.env` file (e.g., `dbinventas`).
    * Import the database schema and tables using the provided `.sql` file (e.g., `db/dbinventas.sql`).
        ```bash
        mysql -u your_db_user -p dbinventas < db/dbinventas.sql
        ```

5.  **Run the application**:
    * The `package.json` provides a start script using `nodemon`.
    ```bash
    npm start
    ```
    * This will start the server, typically on port 3000.

6.  **Access the application**:
    Open your web browser and navigate to `http://localhost:3000`.

---

## Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1.  **Fork** the repository on GitHub.
2.  **Clone** your forked repository to your local machine.
3.  Create a new **branch** for your feature or bug fix (`git checkout -b feature/your-feature-name`).
4.  Make your changes and **commit** them (`git commit -m 'Add some feature'`).
5.  **Push** your changes to your fork on GitHub (`git push origin feature/your-feature-name`).
6.  Open a **Pull Request** from your fork to the original repository.

Please ensure your code follows the project's coding style.

---

## License

This project is licensed under the **MIT License**.
