import { useState, useEffect } from 'react';
import type { EpubData } from '../types';

// Since we are loading JSZip from a CDN, we need to declare it globally for TypeScript
declare const JSZip: any;

export const useEpubParser = (file: File | null) => {
  const [epubData, setEpubData] = useState<EpubData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEpubData(null);
    setIsLoading(false);
    setError(null);
  }

  useEffect(() => {
    const parseEpub = async (epubFile: File) => {
      if (typeof JSZip === 'undefined') {
        setError('La librería JSZip no está cargada.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setEpubData(null);

      try {
        const zip = await JSZip.loadAsync(epubFile);
        const parser = new DOMParser();

        // 1. Find the content.opf file path from container.xml
        const containerFile = zip.file('META-INF/container.xml');
        if (!containerFile) throw new Error('No se encontró META-INF/container.xml.');
        const containerXmlText = await containerFile.async('string');
        const containerDoc = parser.parseFromString(containerXmlText, 'application/xml');
        const contentFilePath = containerDoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
        if (!contentFilePath) throw new Error('No se pudo encontrar la ruta a content.opf.');
        
        const contentFile = zip.file(contentFilePath);
        if (!contentFile) throw new Error(`No se encontró ${contentFilePath}.`);
        const contentXmlText = await contentFile.async('string');
        const contentDoc = parser.parseFromString(contentXmlText, 'application/xml');

        const basePath = contentFilePath.substring(0, contentFilePath.lastIndexOf('/')) + '/';

        // 2. Parse metadata for title and cover
        const metadata = contentDoc.getElementsByTagName('metadata')[0];
        const title = metadata.getElementsByTagName('dc:title')[0]?.textContent || 'Sin título';

        const manifestItems: { [key: string]: { href: string; 'media-type': string } } = {};
        Array.from(contentDoc.getElementsByTagName('item')).forEach(item => {
          const id = item.getAttribute('id');
          const href = item.getAttribute('href');
          const mediaType = item.getAttribute('media-type');
          if(id && href && mediaType) {
            manifestItems[id] = { href: basePath + href, 'media-type': mediaType };
          }
        });
        
        let coverUrl: string | null = null;
        const coverMeta = Array.from(contentDoc.getElementsByTagName('meta')).find(meta => meta.getAttribute('name') === 'cover');
        const coverId = coverMeta?.getAttribute('content');
        if (coverId && manifestItems[coverId]) {
            const coverFile = zip.file(manifestItems[coverId].href);
            if (coverFile) {
                const coverBlob = await coverFile.async('blob');
                coverUrl = URL.createObjectURL(coverBlob);
            }
        }

        // 3. Parse spine for chapter order
        const spine = contentDoc.getElementsByTagName('spine')[0];
        const chapterIds = Array.from(spine.getElementsByTagName('itemref')).map(item => item.getAttribute('idref'));

        // 4. Extract text from chapters
        const chapters: string[] = [];
        for (const id of chapterIds) {
            if (id && manifestItems[id]) {
                const chapterHref = manifestItems[id].href;
                const chapterFile = zip.file(chapterHref);
                if (chapterFile) {
                    const chapterHtmlText = await chapterFile.async('string');
                    const chapterDoc = parser.parseFromString(chapterHtmlText, 'application/xhtml+xml');
                    const paragraphs = Array.from(chapterDoc.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
                                           .map(p => p.textContent?.trim())
                                           .filter(Boolean); // Filter out empty strings
                    if (paragraphs.length > 0) {
                        chapters.push(paragraphs.join('\n\n'));
                    }
                }
            }
        }
        
        if (chapters.length === 0) {
          throw new Error("No se pudo extraer contenido de texto del EPUB.");
        }

        setEpubData({ title, coverUrl, chapters, filename: epubFile.name });

      } catch (e) {
        console.error('EPUB parsing error:', e);
        setError(e instanceof Error ? e.message : 'Ocurrió un error desconocido durante el procesamiento.');
      } finally {
        setIsLoading(false);
      }
    };

    if (file) {
      parseEpub(file);
    }
  }, [file]);

  return { epubData, isLoading, error, reset };
};