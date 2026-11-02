import RecipeLibrary from "../components/RecipeLibrary";
import Sidebar from "../components/layout/Sidebar";
import SiteFooter from "../components/layout/SiteFooter";

export default function LibraryPage() {
  return (
    <div className="flex flex-1">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col gap-7 px-4 pt-8 sm:px-10">
        <RecipeLibrary />
        <SiteFooter />
      </main>
    </div>
  );
}
