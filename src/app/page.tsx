import PageShell from "@/components/PageShell";
import { getPhotos } from "@/lib/photos";

/**
 * Серверний компонент: читає public/photos під час збірки й передає список
 * далі. Завдяки цьому додати фото — це буквально «кинути файли в теку»,
 * без жодного конфіга, а сторінка все одно лишається статичною.
 */
export default function Page() {
  const photos = getPhotos();
  return <PageShell photos={photos} />;
}
