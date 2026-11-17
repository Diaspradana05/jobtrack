// Bundle browser pptxgenjs (tanpa modul Node seperti fs/https). Diketik longgar agar tidak bergantung pada tipe versi tertentu.
declare module "pptxgenjs/dist/pptxgen.bundle.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PptxGenJS: any;
  export default PptxGenJS;
}
