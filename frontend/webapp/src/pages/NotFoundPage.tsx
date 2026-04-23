/**
 * NotFoundPage.tsx
 *
 * A minimal 404 page rendered when the user navigates to a route that does not
 * exist within the application. Displayed by the React Router catch-all route.
 */

// --- Component ---

/**
 * NotFoundPage
 *
 * Intentionally minimal — the sole purpose of this page is to clearly
 * communicate that the requested route was not found.
 */
const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">404. Seite konnte nicht gefunden werden.</h1>
    </div>
  );
};

export default NotFoundPage;