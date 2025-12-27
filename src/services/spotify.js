import fetch from "node-fetch";
import { config } from "../config.js";

// Кэш для Spotify access token
let spotifyToken = null;
let tokenExpiry = 0;

// Получение токена доступа
async function getSpotifyToken() {
    if (spotifyToken && Date.now() < tokenExpiry) {
        return spotifyToken;
    }

    const auth = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`Spotify token error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        spotifyToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // -1 минута для безопасности
        
        console.log('✅ Spotify token получен');
        return spotifyToken;
    } catch (err) {
        console.error('❌ Ошибка получения Spotify token:', err.message);
        throw err;
    }
}

// Маппинг контекста на audio features
function contextToAudioFeatures(context, energy) {
    const features = {};

    // Energy параметры
    if (energy === 'low') {
        features.target_energy = 0.3;
        features.target_tempo = 90;
    } else if (energy === 'medium') {
        features.target_energy = 0.6;
        features.target_tempo = 110;
    } else if (energy === 'high') {
        features.target_energy = 0.85;
        features.target_tempo = 130;
    }

    // Контекст влияет на дополнительные параметры
    if (context === 'studying' || context === 'focus') {
        features.target_instrumentalness = 0.7;
        features.target_speechiness = 0.05;
    } else if (context === 'late_night' || context === 'chill') {
        features.target_valence = 0.4; // Более спокойная музыка
        features.target_acousticness = 0.6;
    } else if (context === 'party') {
        features.target_danceability = 0.8;
        features.target_valence = 0.7;
    } else if (context === 'background') {
        features.target_instrumentalness = 0.5;
    }

    return features;
}

// Получение чартов Казахстана
async function getKazakhstanCharts(limit = 20) {
    try {
        const token = await getSpotifyToken();
        
        // Ищем официальный плейлист Top 50 Kazakhstan
        const searchUrl = `https://api.spotify.com/v1/search?q=Top%2050%20Kazakhstan&type=playlist&market=KZ&limit=5`;
        
        const searchRes = await fetch(searchUrl, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!searchRes.ok) {
            console.warn(`⚠️ Spotify search error: ${searchRes.status}`);
            return [];
        }

        const searchData = await searchRes.json();
        
        // Ищем плейлист с ключевыми словами
        const targetPlaylists = searchData.playlists?.items || [];
        const playlist = targetPlaylists.find(p => 
            p.name.includes('Top 50') && 
            (p.name.includes('Kazakhstan') || p.name.includes('Kazakh') || p.name.includes('KZ'))
        );

        if (!playlist) {
            console.warn('⚠️ Top 50 Kazakhstan плейлист не найден, используем альтернативные');
            
            // Пробуем найти другие популярные плейлисты для Казахстана
            const kzPlaylists = targetPlaylists.filter(p => 
                p.description && (p.description.includes('Kazakh') || p.description.includes('Казахстан'))
            );
            
            if (kzPlaylists.length > 0) {
                const playlistId = kzPlaylists[0].id;
                const playlistUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=KZ&limit=${limit}`;
                
                const playlistRes = await fetch(playlistUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (playlistRes.ok) {
                    const playlistData = await playlistRes.json();
                    return playlistData.items?.map(item => item.track).filter(t => t) || [];
                }
            }
            
            return [];
        }
        
        const playlistId = playlist.id;
        
        // Получаем треки из плейлиста
        const playlistUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=KZ&limit=${limit}`;
        
        const playlistRes = await fetch(playlistUrl, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!playlistRes.ok) {
            console.warn(`⚠️ Ошибка получения плейлиста: ${playlistRes.status}`);
            return [];
        }
        
        const playlistData = await playlistRes.json();
        
        return playlistData.items?.map(item => item.track).filter(t => t) || [];
        
    } catch (err) {
        console.error('❌ Ошибка получения чартов KZ:', err.message);
        return [];
    }
}

// Проверка валидности жанра
function validateGenre(genre) {
    const validGenres = [
        'acoustic', 'afrobeat', 'alt-rock', 'alternative', 'ambient',
        'anime', 'black-metal', 'bluegrass', 'blues', 'bossanova',
        'brazil', 'breakbeat', 'british', 'cantopop', 'chicago-house',
        'children', 'chill', 'classical', 'club', 'comedy',
        'country', 'dance', 'dancehall', 'death-metal', 'deep-house',
        'detroit-techno', 'disco', 'disney', 'drum-and-bass', 'dub',
        'dubstep', 'edm', 'electro', 'electronic', 'emo',
        'folk', 'forro', 'french', 'funk', 'garage',
        'german', 'gospel', 'goth', 'grindcore', 'groove',
        'grunge', 'guitar', 'happy', 'hard-rock', 'hardcore',
        'hardstyle', 'heavy-metal', 'hip-hop', 'holidays', 'honky-tonk',
        'house', 'idm', 'indian', 'indie', 'indie-pop',
        'industrial', 'iranian', 'j-dance', 'j-idol', 'j-pop',
        'j-rock', 'jazz', 'k-pop', 'kids', 'latin',
        'latino', 'malay', 'mandopop', 'metal', 'metal-misc',
        'metalcore', 'minimal-techno', 'movies', 'mpb', 'new-age',
        'new-release', 'opera', 'pagode', 'party', 'philippines-opm',
        'piano', 'pop', 'pop-film', 'post-dubstep', 'power-pop',
        'progressive-house', 'psych-rock', 'punk', 'punk-rock', 'r-n-b',
        'rainy-day', 'reggae', 'reggaeton', 'road-trip', 'rock',
        'rock-n-roll', 'rockabilly', 'romance', 'sad', 'salsa',
        'samba', 'sertanejo', 'show-tunes', 'singer-songwriter', 'ska',
        'sleep', 'songwriter', 'soul', 'soundtracks', 'spanish',
        'study', 'summer', 'swedish', 'synth-pop', 'tango',
        'techno', 'trance', 'trip-hop', 'turkish', 'work-out',
        'world-music'
    ];

    // Маппинг наших жанров на валидные Spotify жанры
    const genreMapping = {
        'indie': 'indie',
        'pop': 'pop',
        'rock': 'rock',
        'electronic': 'electronic',
        'jazz': 'jazz',
        'hip-hop': 'hip-hop',
        'hiphop': 'hip-hop'
    };

    const mappedGenre = genreMapping[genre] || genre;
    return validGenres.includes(mappedGenre) ? mappedGenre : 'pop'; // fallback на pop
}

// Получение рекомендаций по параметрам
async function getRecommendations(params) {
    try {
        const token = await getSpotifyToken();
        const { genres, period, context, energy, market = 'KZ' } = params;
        
        const audioFeatures = contextToAudioFeatures(context, energy);
        
        // Валидируем и маппим жанры
        const validatedGenres = genres.map(validateGenre);
        const seedGenres = validatedGenres.slice(0, 3).join(','); // Максимум 3 жанра
        
        if (!seedGenres) {
            console.warn('⚠️ Нет валидных жанров для запроса');
            return [];
        }
        
        // Формируем URL с параметрами
        let url = `https://api.spotify.com/v1/recommendations?market=${market}&seed_genres=${seedGenres}&limit=30`;
        
        // Добавляем audio features
        Object.entries(audioFeatures).forEach(([key, value]) => {
            url += `&${key}=${value}`;
        });
        
        console.log(`🔗 Spotify API запрос: ${url.split('?')[0]}...`);
        
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 10000 // 10 секунд таймаут
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Не удалось прочитать тело ошибки');
            console.error(`❌ Spotify API error ${response.status}:`, errorText);
            return [];
        }
        
        const data = await response.json();
        
        if (!data.tracks || !Array.isArray(data.tracks)) {
            console.warn('⚠️ Spotify не вернул треки или формат неверный');
            return [];
        }
        
        let tracks = data.tracks;
        
        // Фильтруем по периоду (если указан)
        if (period && period !== 'all') {
            const [startYear, endYear] = period.split('-').map(y => 
                y === 'now' ? new Date().getFullYear() : parseInt(y)
            );
            
            tracks = tracks.filter(t => {
                if (!t.album?.release_date) return false;
                const year = new Date(t.album.release_date).getFullYear();
                return year >= startYear && year <= endYear;
            });
        }
        
        return tracks;
        
    } catch (err) {
        console.error('❌ Ошибка Spotify recommendations:', err.message || err);
        return [];
    }
}

// Фолбэк треки (если Spotify не работает)
function getFallbackTracks(genre, context) {
    const fallbackTracks = [
        {
            id: 'fallback1',
            name: 'Starlight',
            artists: [{ name: 'The Midnight' }],
            album: { 
                name: 'Endless Summer',
                images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2737a2e55b3f8f7c7a7b3f7e5e2' }],
                release_date: '2016-01-01'
            },
            preview_url: null,
            external_urls: { spotify: 'https://open.spotify.com/track/0t2Z2q5Fkq1REFEjLpD7eF' },
            duration_ms: 235000,
            explicit: false
        },
        {
            id: 'fallback2',
            name: 'Sunset Lover',
            artists: [{ name: 'Petit Biscuit' }],
            album: { 
                name: 'Sunset Lover',
                images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2731c5e8e2e5a8e8a5e8e5a8e2' }],
                release_date: '2015-01-01'
            },
            preview_url: null,
            external_urls: { spotify: 'https://open.spotify.com/track/0hNduWmlWmEmuwEFcYvRu1' },
            duration_ms: 213000,
            explicit: false
        }
    ];
    
    return fallbackTracks;
}

// Главная функция поиска музыки
export async function searchMusic(params, userType) {
    const { genres, period, context } = params;
    console.log(`🎯 Адаптивный поиск: ${genres.join(', ')} (${period}) для ${context}`);

    let allTracks = [];

    try {
        const token = await getSpotifyToken();

        // 1. Создаем поисковые запросы на основе жанров и контекста
        const searchQueries = [];
        for (const genre of genres.slice(0, 2)) { // Берем до 2 жанров
            // Добавляем в запрос слова, связанные с контекстом
            let contextModifier = '';
            if (context === 'chill') contextModifier = 'chill ';
            if (context === 'focus') contextModifier = 'instrumental study ';
            if (context === 'party') contextModifier = 'dance ';
            if (context === 'late_night') contextModifier = 'nocturnal ';

            searchQueries.push(`${contextModifier}${genre}`);
        }

        // 2. Выполняем поиск по каждому запросу
        for (const query of searchQueries) {
            try {
                const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&market=KZ&limit=15`;
                const response = await fetch(searchUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    console.warn(`⚠️ Поиск для "${query}" не удался: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                if (data.tracks?.items) {
                    allTracks.push(...data.tracks.items);
                }
            } catch (err) {
                console.error(`❌ Ошибка поиска "${query}":`, err.message);
            }
        }

        // 3. Фильтруем по году, если период указан
        if (period && period !== 'all') {
            const [startYear, endYear] = period.split('-').map(y =>
                y === 'now' ? new Date().getFullYear() : parseInt(y)
            );
            allTracks = allTracks.filter(track => {
                if (!track.album?.release_date) return false;
                const year = new Date(track.album.release_date).getFullYear();
                return year >= startYear && year <= endYear;
            });
        }

        // 4. Убираем дубликаты
        const uniqueTracks = Array.from(new Map(allTracks.map(t => [t.id, t])).values());

        // 5. Фильтруем по explicit для подростков
        const filtered = uniqueTracks.filter(track => {
            if (userType && userType.includes('teenager')) {
                return track.explicit === false;
            }
            return true;
        });

        // 6. Если треков нет, используем фолбэк
        if (filtered.length === 0) {
            console.log('⚠️ Не найдено треков, использую фолбэк');
            return getFallbackTracks(genres[0], context).slice(0, 3);
        }

        console.log(`✅ Найдено ${filtered.length} треков через адаптивный поиск`);
        return filtered.slice(0, 6); // Возвращаем до 6 треков

    } catch (err) {
        console.error('🔥 Ошибка в searchMusic:', err.message);
        // Возвращаем фолбэк треки при любой ошибке
        return getFallbackTracks(genres[0], context).slice(0, 3);
    }
}