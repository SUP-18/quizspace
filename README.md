# QuizSpace 🚀

QuizSpace is a modern, fully-featured programming quiz and examination platform. It allows users to take simulated timed exams across various programming categories, track their performance through a detailed analytics dashboard, and review their answers to improve their skills.

## 🎯 Features

- **Professional Exam Mode:** Timed exams with customizable categories, difficulty levels, and question counts. Includes a question palette for easy navigation and marking questions for review.
- **Analytics Dashboard:** Visualizes your performance with real-time charts (score trends, category/difficulty breakdown, and answer accuracy) built with HTML5 Canvas.
- **Results & Review System:** Detailed post-exam breakdowns allowing you to filter through correct, incorrect, and unanswered questions alongside detailed explanations.
- **Progress Tracking:** Tracks your daily/weekly goals, study streaks, and unlocks achievements based on your activity.
- **Light & Dark Mode:** A persistent theme toggle to suit your viewing preferences.

## 🛠️ Tech Stack

This project is built using vanilla web technologies, ensuring high performance and simple deployment without the need for complex build tools.

- **HTML5**
- **CSS3** (Custom properties, Flexbox/Grid, Animations)
- **Vanilla JavaScript (ES6+)**

### Backend & Data Storage

Currently, QuizSpace **does not require a backend, database, or authentication provider**. 
- All data, including user sessions, exam history, settings, and analytics, is stored entirely in the browser's `localStorage`.
- There are no `.env` files, API keys, or private credentials to configure.
- Passwords entered during signup are stored locally for simulation purposes.

## 🚀 How to Run Locally

Since this is a static client-side application, you don't need `npm install` or any complex build commands.

1. **Option 1: Using a simple static server (Recommended)**
   If you have Python installed, open your terminal in the project directory and run:
   ```bash
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000` in your browser.

2. **Option 2: Using VS Code Live Server**
   - Open the project folder in Visual Studio Code.
   - Install the "Live Server" extension.
   - Right-click `index.html` and select **"Open with Live Server"**.

3. **Option 3: Direct File Execution**
   - Simply double-click `index.html` in your file explorer to open it directly in your browser (`file:///.../index.html`). Note that some advanced local storage features or modular scripts might behave slightly differently via the `file://` protocol depending on your browser.

## 📦 Deployment to Production

Because this is a static site, it can be hosted on any static file hosting service for free in seconds.

**Recommended platforms:**
- [GitHub Pages](https://pages.github.com/)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [Cloudflare Pages](https://pages.cloudflare.com/)

**Deployment Steps (e.g., for Netlify or Vercel):**
1. Push this repository to GitHub.
2. Log in to Netlify or Vercel and select "Add New Project".
3. Import your GitHub repository.
4. **Build Command:** Leave empty (none required).
5. **Publish / Output Directory:** `.` (or leave default/empty, as the root folder contains `index.html`).
6. Click Deploy!

## 📂 Project Structure

- `index.html` - The single-page application shell containing all UI layouts.
- `style.css` - All styling, themes, animations, and responsive layout rules.
- `script.js` - Main application logic, routing between screens, and UI interactions.
- `auth.js` - Simulated authentication and user session management.
- `data.js` - Local database interface for saving/retrieving exam histories and calculating analytics.
- `questions.js` - The question bank database.
- `exam.js` - Core exam engine (timer, state, navigation, scoring, results rendering).
- `analytics.js` - Canvas-based charting and insight generation.

## 📝 License

This project is open-source and available for educational purposes.

## 🚀 How to Use QuizSpace

1. Open the QuizSpace website in your browser.
2. Choose your preferred quiz category and difficulty level.
3. Select the number of questions and start the exam.
4. Answer the questions within the given time limit.
5. Review your results and read the explanations.
6. Track your progress and work toward your daily learning goals.

## 🎯 Future Improvements

- Add more quiz categories and questions.
- Improve accessibility and mobile responsiveness.
- Introduce more practice modes for different learning levels.
- Enhance performance analytics to help users identify weak areas.

## 🤝 Contributions

Suggestions, bug reports, and improvements are welcome! Feel free to explore the project and help make QuizSpace better.

