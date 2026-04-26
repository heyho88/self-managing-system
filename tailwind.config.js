/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Pretendard',
          'Noto Sans KR',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
