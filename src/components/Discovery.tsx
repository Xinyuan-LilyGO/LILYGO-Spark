import React, { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Hash, Calendar, RefreshCw } from 'lucide-react';
// Browser-compatible RSS parser import
import Parser from 'rss-parser/dist/rss-parser.min.js';
import mockNews from '../assets/mock_news.json';

interface NewsItem {
    id: string;
    title: string;
    summary: string;
    source: string;
    url: string;
    imageUrl?: string;
    date: string;
    tags: string[];
}

const Discovery: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDirectRSS = async () => {
        try {
            // Note: CORS might block these requests in browser, but Electron should be fine if webSecurity is disabled or via IPC
            // If in browser dev mode, we might need a proxy. For now assuming Electron environment or CORS-friendly feeds.
            
            const parser = new Parser();
            const feeds = [
                { url: 'https://hackaday.com/category/esp32/feed/', source: 'Hackaday' },
                { url: 'https://www.cnx-software.com/feed/', source: 'CNX' },
                { url: 'https://blog.adafruit.com/feed/', source: 'Adafruit' }
            ];

            const results = await Promise.allSettled(feeds.map(f => parser.parseURL(f.url)));
            
            let aggregated: NewsItem[] = [];
            
            results.forEach((res, index) => {
                if (res.status === 'fulfilled') {
                    const source = feeds[index].source;
                    const items = res.value.items.slice(0, 5).map((item: { guid?: string; link?: string; title?: string; contentSnippet?: string; pubDate?: string }) => ({
                        id: item.guid || item.link || Math.random().toString(),
                        title: item.title || 'Untitled',
                        summary: item.contentSnippet?.substring(0, 150) + '...' || '',
                        source: source,
                        url: item.link || '',
                        date: item.pubDate || new Date().toISOString(),
                        tags: ['News']
                    }));
                    aggregated = [...aggregated, ...items];
                }
            });

            // Fallback to mock if RSS also fails (e.g. network down)
            if (aggregated.length === 0) {
                return mockNews as NewsItem[];
            }

            // Simple Sort: Freshness
            return aggregated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        } catch (e) {
            console.warn('Direct RSS fetch failed', e);
            return mockNews as NewsItem[];
        }
    };

    const fetchNews = async () => {
        setLoading(true);
        setError(null);
        try {
            let apiBaseUrl = 'http://localhost:9000'; // Default local dev
            if (window.ipcRenderer) {
                try {
                    apiBaseUrl = await window.ipcRenderer.invoke('get-api-base-url');
                } catch (e) {
                    console.warn('Failed to get API base URL, using default', e);
                }
            }

            // 1. Try to fetch from real API (LILYGO-Spark-Server)
            try {
                const response = await fetch(`${apiBaseUrl}/news`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data.length > 0) {
                        setNews(data.data);
                        return;
                    }
                }
                throw new Error('API returned empty or invalid data');
            } catch (e) {
                console.warn('API fetch failed, trying direct RSS fallback', e);
                
                // 2. Fallback: Client-side RSS Fetch
                const fallbackNews = await fetchDirectRSS();
                setNews(fallbackNews);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load news');
            // Final fallback
            setNews(mockNews as NewsItem[]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Newspaper className="text-primary" />
                        Spark Discovery
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Latest news and inspiration from the ESP32 community.
                    </p>
                </div>
                <button 
                    onClick={fetchNews}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-64 rounded-2xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-20 text-red-500">
                        {error}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {news.map(item => (
                            <div 
                                key={item.id}
                                className="group bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 flex flex-col"
                            >
                                {/* Image Area */}
                                <div className="h-48 bg-slate-100 dark:bg-zinc-900 overflow-hidden relative">
                                    {item.imageUrl ? (
                                        <img 
                                            src={item.imageUrl} 
                                            alt={item.title} 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div className={`w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-900 text-slate-300 dark:text-zinc-700 ${item.imageUrl ? 'hidden' : 'flex'}`}>
                                        <Newspaper size={48} />
                                    </div>
                                    
                                    {/* Source Badge */}
                                    <div className="absolute top-3 left-3 z-10">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-md ${
                                            item.source === 'Hackaday' ? 'bg-black/80 text-white' :
                                            item.source === 'Reddit' ? 'bg-orange-500/90 text-white' :
                                            item.source === 'GitHub' ? 'bg-gray-800/90 text-white' :
                                            item.source === 'M5Stack' ? 'bg-blue-600/90 text-white' :
                                            item.source === 'Seeed' ? 'bg-green-500/90 text-white' :
                                            item.source === 'Adafruit' ? 'bg-pink-600/90 text-white' :
                                            item.source === 'CNX' ? 'bg-blue-400/90 text-white' :
                                            'bg-indigo-500/90 text-white'
                                        }`}>
                                            {item.source}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3 flex-1">
                                        {item.summary}
                                    </p>
                                    
                                    {/* Footer */}
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-zinc-700/50">
                                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} />
                                                {formatDate(item.date)}
                                            </span>
                                            {item.tags.slice(0, 2).map(tag => (
                                                <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700/50">
                                                    <Hash size={10} />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        
                                        <a 
                                            href={item.url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="p-2 rounded-full bg-slate-50 dark:bg-zinc-700/50 text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Discovery;
