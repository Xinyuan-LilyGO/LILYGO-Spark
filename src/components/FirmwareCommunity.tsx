import React, { useEffect, useState } from 'react';
import { Search, ExternalLink, Download, FileCode, Cpu, RefreshCw, ChevronDown, ChevronRight, Layers, Github } from 'lucide-react';

interface ProductVariant {
  product_id: string;
  name: string;
  description: string;
  mcu: string;
  github_repo: string;
  product_page: string;
  image_url: string;
}

interface ProductGroup {
  id?: string; // Series ID
  product_id?: string; // Single product ID
  name: string;
  description: string;
  image_url: string;
  variants?: ProductVariant[];
  // Single product fields
  mcu?: string;
  github_repo?: string;
  product_page?: string;
}

interface Firmware {
  supported_product_ids: string[];
  name: string;
  version: string;
  type: string;
  filename: string;
  download_url: string;
  description: string;
  hash_md5?: string;
  release_note?: string;
}

interface Manifest {
  product_list: ProductGroup[];
  firmware_list: Firmware[];
}

const FirmwareCommunity: React.FC = () => {
  const [manifest, setManifest] = useState<Manifest>({ product_list: [], firmware_list: [] });
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  const loadManifest = async () => {
    setLoading(true);
    try {
      // @ts-ignore - ipcRenderer is exposed via contextBridge
      const data = await window.ipcRenderer.invoke('get-firmware-manifest');
      setManifest(data);
      
      // Select first available product
      if (data.product_list.length > 0 && !selectedProductId) {
        const first = data.product_list[0];
        if (first.variants && first.variants.length > 0) {
          setSelectedProductId(first.variants[0].product_id);
          if (first.id) toggleSeries(first.id, true);
        } else if (first.product_id) {
          setSelectedProductId(first.product_id);
        }
      }
    } catch (error) {
      console.error('Failed to load manifest:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManifest();
  }, []);

  const toggleSeries = (seriesId: string, forceState?: boolean) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      const shouldExpand = forceState !== undefined ? forceState : !next.has(seriesId);
      if (shouldExpand) {
        next.add(seriesId);
      } else {
        next.delete(seriesId);
      }
      return next;
    });
  };

  // Helper to find product details by ID (could be single product or variant)
  const findProductById = (id: string | null): ProductVariant | ProductGroup | null => {
    if (!id) return null;
    for (const group of manifest.product_list) {
      if (group.product_id === id) return group;
      if (group.variants) {
        const variant = group.variants.find(v => v.product_id === id);
        if (variant) return variant;
      }
    }
    return null;
  };

  const selectedProduct = findProductById(selectedProductId);

  const relatedFirmwares = manifest.firmware_list.filter(f => 
    selectedProductId && f.supported_product_ids.includes(selectedProductId)
  );

  // Filter logic
  const filteredGroups = manifest.product_list.map(group => {
    // If it's a single product, check match
    if (!group.variants) {
      const matches = group.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      group.mcu?.toLowerCase().includes(searchQuery.toLowerCase());
      return matches ? group : null;
    }

    // If it's a series, check if series matches OR any variant matches
    const seriesMatches = group.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchingVariants = group.variants.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.mcu.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (seriesMatches || matchingVariants.length > 0) {
      // Return group but maybe with filtered variants? 
      // For now let's keep all variants if series matches, or just matching variants if series doesn't match?
      // Better UX: if searching, expand relevant series.
      return {
        ...group,
        variants: seriesMatches ? group.variants : matchingVariants
      };
    }
    return null;
  }).filter(Boolean) as ProductGroup[];

  // Auto-expand series if searching
  useEffect(() => {
    if (searchQuery) {
      const newExpanded = new Set<string>();
      filteredGroups.forEach(g => {
        if (g.variants && g.id) newExpanded.add(g.id);
      });
      setExpandedSeries(newExpanded);
    }
  }, [searchQuery]);

  return (
    <div className="flex h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Left Column: Device List */}
      <div className="w-[36%] min-w-[375px] max-w-[500px] border-r border-slate-700 flex flex-col bg-slate-800/50">
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search devices..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 placeholder-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {loading ? (
             <div className="text-center py-10 text-slate-500">Loading devices...</div>
          ) : filteredGroups.length === 0 ? (
             <div className="text-center py-10 text-slate-500">No devices found</div>
          ) : (
            filteredGroups.map(group => {
              const isSeries = !!group.variants && group.variants.length > 0;
              const isExpanded = group.id ? expandedSeries.has(group.id) : false;
              
              if (isSeries) {
                return (
                  <div key={group.id}>
                    {/* Series Header */}
                    <div 
                      onClick={() => group.id && toggleSeries(group.id)}
                      className="flex items-center p-3 rounded-xl cursor-pointer hover:bg-slate-700/50 transition-colors select-none group/header"
                    >
                      <div className="h-16 flex items-center justify-center mr-2 text-slate-500 group-hover/header:text-slate-300 transition-colors">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div className="w-16 h-16 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 overflow-hidden mr-3 shadow-sm">
                         <img 
                           src={group.image_url} 
                           alt={group.name} 
                           className="max-w-full max-h-full object-contain"
                           onError={(e) => {
                             (e.target as HTMLImageElement).style.display = 'none';
                             ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                           }}
                         />
                         <div className="hidden w-full h-full items-center justify-center bg-slate-200 text-slate-400">
                            <Layers size={24} />
                         </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-200">{group.name}</h3>
                        <div className="flex items-center text-xs text-slate-500 mt-1">
                           <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 mr-2">{group.variants?.length} variants</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">{group.description}</p>
                      </div>
                    </div>

                    {/* Variants List */}
                    {isExpanded && (
                      <div className="ml-[20px] pl-6 border-l-2 border-slate-700/50 mt-1 space-y-1">
                        {group.variants?.map(variant => (
                          <div 
                            key={variant.product_id}
                            onClick={() => setSelectedProductId(variant.product_id)}
                            className={`p-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center ${
                              selectedProductId === variant.product_id 
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30' 
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`}
                          >
                             <div className="w-12 h-12 bg-white rounded-md p-1 flex items-center justify-center shrink-0 mr-3 overflow-hidden shadow-sm">
                                <img 
                                   src={variant.image_url} 
                                   alt={variant.name} 
                                   className="max-w-full max-h-full object-contain"
                                   onError={(e) => {
                                     (e.target as HTMLImageElement).style.display = 'none';
                                     ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                                   }}
                                 />
                                 <div className="hidden w-full h-full items-center justify-center bg-slate-200 text-slate-400">
                                    <Cpu size={16} />
                                 </div>
                             </div>
                             <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{variant.name}</div>
                                <div className="text-[10px] opacity-70">{variant.mcu}</div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Single Product
              return (
                <div 
                  key={group.product_id}
                  onClick={() => setSelectedProductId(group.product_id!)}
                  className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border flex items-center ${
                    selectedProductId === group.product_id 
                      ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-900/10' 
                      : 'bg-slate-800 border-transparent hover:bg-slate-700 hover:border-slate-600'
                  }`}
                >
                  {/* Invisible spacer to match Series chevron width (18px icon + mr-2) roughly 26px */}
                  <div className="w-[18px] mr-2 shrink-0"></div>

                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-16 h-16 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                       <img 
                         src={group.image_url} 
                         alt={group.name} 
                         className="max-w-full max-h-full object-contain"
                         onError={(e) => {
                           (e.target as HTMLImageElement).style.display = 'none';
                           ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                         }}
                       />
                       <div className="hidden w-full h-full items-center justify-center bg-slate-200 text-slate-400">
                          <Cpu size={24} />
                       </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${selectedProductId === group.product_id ? 'text-blue-400' : 'text-slate-200'}`}>
                        {group.name}
                      </h3>
                      <div className="flex items-center text-xs text-slate-500 mt-1">
                        <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 mr-2">{group.mcu}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{group.description}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Firmware Details */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        {selectedProduct ? (
          <>
            {/* Header Product Info */}
            <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
               <div className="flex items-start justify-between">
                 <div>
                    <h2 className="text-3xl font-bold text-white mb-2">{selectedProduct.name}</h2>
                    <p className="text-slate-400 max-w-2xl">{selectedProduct.description}</p>
                    <div className="flex items-center space-x-4 mt-4">
                        {selectedProduct.github_repo && (
                          <a href={selectedProduct.github_repo} target="_blank" rel="noreferrer" className="flex items-center text-slate-400 hover:text-white transition-colors text-sm">
                              <Github size={16} className="mr-1.5" /> GitHub Repo
                          </a>
                        )}
                        {selectedProduct.product_page && (
                          <a href={selectedProduct.product_page} target="_blank" rel="noreferrer" className="flex items-center text-slate-400 hover:text-white transition-colors text-sm">
                              <ExternalLink size={16} className="mr-1.5" /> Product Page
                          </a>
                        )}
                    </div>
                 </div>
                 {/* Large Image Preview */}
                 <div className="w-32 h-32 bg-white rounded-xl p-2 flex items-center justify-center shadow-2xl">
                    <img src={selectedProduct.image_url} alt="" className="max-w-full max-h-full object-contain" />
                 </div>
               </div>
            </div>

            {/* Firmware List */}
            <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <FileCode className="mr-2 text-blue-500" /> 
                    Available Firmware
                    <span className="ml-3 text-sm font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                        {relatedFirmwares.length}
                    </span>
                </h3>

                {relatedFirmwares.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
                        No firmware found for this device in the manifest.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {relatedFirmwares.map((fw, idx) => (
                            <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-blue-500/50 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-1">
                                            <h4 className="text-lg font-medium text-slate-200">{fw.name}</h4>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                                fw.type === 'factory' ? 'bg-green-900/30 text-green-400 border-green-800' :
                                                fw.type === 'micropython' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800' :
                                                'bg-blue-900/30 text-blue-400 border-blue-800'
                                            }`}>
                                                {fw.type.toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400 mb-2">{fw.description}</p>
                                        <div className="flex items-center space-x-4 text-xs text-slate-500 font-mono">
                                            <span>Ver: {fw.version}</span>
                                            {fw.filename && <span>File: {fw.filename}</span>}
                                        </div>
                                    </div>
                                    
                                    <button 
                                        className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                                        onClick={() => {
                                            // Handle download/flash logic here
                                            console.log('Download', fw.download_url);
                                            alert(`Coming soon: Auto-download ${fw.filename}`);
                                        }}
                                    >
                                        <Download size={18} className="mr-2" />
                                        Flash / Download
                                    </button>
                                </div>
                                {fw.release_note && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-sm text-slate-400">
                                        <span className="text-slate-500 font-semibold mr-2">Note:</span>
                                        {fw.release_note}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <RefreshCw size={48} className="mb-4 opacity-20" />
                <p>Select a device to view firmware</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default FirmwareCommunity;
