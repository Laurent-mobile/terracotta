// src/components/settings/QRCodeManager.tsx
import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, Copy, Check, QrCode, Building, Globe, Edit2, Save, X, ExternalLink, Image } from 'lucide-react';

interface QRCodeManagerProps {
  restaurantName: string;
  baseUrl: string;
}

export default function QRCodeManager({ restaurantName, baseUrl }: QRCodeManagerProps) {
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(256);
  const [customUrl, setCustomUrl] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [savedUrl, setSavedUrl] = useState('');
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('menuImageUrl');
    if (saved) {
      setSavedUrl(saved);
    } else {
      // URL par défaut de votre image
      setSavedUrl('https://pixelsbf.com/wp-content/uploads/2026/05/qr-code-la-terra-cotta-ouaga.png');
    }
  }, []);

  // L'URL complète du QR code (pointe directement vers l'image)
  const qrDestination = savedUrl;

  const handleSaveUrl = () => {
    let url = customUrl.trim();
    
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    if (url) {
      localStorage.setItem('menuImageUrl', url);
      setSavedUrl(url);
      setIsEditingUrl(false);
      setCustomUrl('');
      alert(`✅ QR code mis à jour : ${url}`);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrDestination);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeRef.current) return;
    
    const svg = qrCodeRef.current.querySelector('svg');
    if (!svg) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = qrSize;
      canvas.height = qrSize;
      ctx?.drawImage(img, 0, 0, qrSize, qrSize);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr-code-${restaurantName.toLowerCase().replace(/\s/g, '-')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code Menu - ${restaurantName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .qr-container {
            text-align: center;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 12px;
          }
          .restaurant-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .instruction {
            color: #666;
            margin-top: 20px;
            font-size: 14px;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .qr-container { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="restaurant-name">${restaurantName}</div>
          <div>${qrCodeRef.current?.innerHTML || ''}</div>
          <div class="instruction">
            Scannez ce QR code pour accéder au menu numérique
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #999;">
            ${qrDestination}
          </div>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const resetToDefault = () => {
    localStorage.removeItem('menuImageUrl');
    setSavedUrl('https://pixelsbf.com/wp-content/uploads/2026/05/qr-code-la-terra-cotta-ouaga.png');
    alert('✅ QR code réinitialisé à l\'URL par défaut');
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 text-white">
        <div className="flex items-center space-x-3 mb-4">
          <QrCode className="w-8 h-8" />
          <div>
            <h3 className="text-xl font-bold">QR Code du Menu</h3>
            <p className="text-slate-300 text-sm">Le QR code pointe directement vers l'image du menu</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Aperçu du QR code */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-900">Aperçu du QR Code</h4>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-slate-600">Taille:</label>
              <select
                value={qrSize}
                onChange={(e) => setQrSize(parseInt(e.target.value))}
                className="px-2 py-1 border border-slate-300 rounded text-sm"
              >
                <option value="128">Petit</option>
                <option value="256">Moyen</option>
                <option value="512">Grand</option>
              </select>
            </div>
          </div>
          
          <div 
            ref={qrCodeRef}
            className="flex justify-center items-center bg-white p-6 rounded-lg border border-slate-200"
            style={{ minHeight: qrSize + 48 }}
          >
            <QRCodeSVG 
              value={qrDestination} 
              size={qrSize}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#1e293b"
            />
          </div>

          {/* Section de modification d'URL */}
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              🖼️ URL de l'image du menu
            </label>
            
            {isEditingUrl ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://exemple.com/menu.jpg"
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveUrl}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    title="Sauvegarder"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsEditingUrl(false)}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    title="Annuler"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  💡 Saisissez l'URL complète de votre image (PNG, JPG)
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1">
                  <p className="text-sm text-slate-600 break-all font-mono bg-white p-2 rounded border">
                    {qrDestination}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsEditingUrl(true)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Modifier l'URL"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={resetToDefault}
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition text-xs"
                    title="Réinitialiser"
                  >
                    Réinitialiser
                  </button>
                  <a
                    href={qrDestination}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    title="Voir l'image"
                  >
                    <Image className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={handleDownloadQR}
              className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 transition flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger QR</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={handleCopyUrl}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center space-x-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copier le lien</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Image className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Comment ça fonctionne ?</h4>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li>• Le QR code pointe directement vers votre image de menu</li>
                  <li>• Les clients scannent et voient immédiatement le menu</li>
                  <li>• Pas besoin d'application, juste l'appareil photo du téléphone</li>
                  <li>• Vous pouvez changer l'URL à tout moment</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-900 mb-2">Votre image actuelle</h4>
                <p className="text-sm text-amber-800 mb-2">
                  URL configurée : 
                  <code className="block bg-amber-100 p-2 rounded mt-1 text-xs break-all">
                    https://pixelsbf.com/wp-content/uploads/2026/05/qr-code-la-terra-cotta-ouaga.png
                  </code>
                </p>
                <a 
                  href={qrDestination}
                  target="_blank"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1 mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Voir l'image</span>
                </a>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <QrCode className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-green-900 mb-2">Testez le QR code</h4>
                <p className="text-sm text-green-800 mb-3">
                  Scannez ce QR code avec votre téléphone pour vérifier qu'il affiche bien votre image de menu.
                </p>
                <div className="text-xs text-green-700">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
