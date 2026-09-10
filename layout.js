import "./globals.css";

export const metadata = {
  title: "FTW Fantasy",
  description: "Fantasy football decisions without the clutter.",
  applicationName: "FTW Fantasy",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
