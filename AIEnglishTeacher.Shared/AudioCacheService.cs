using System.Collections.Concurrent;

namespace AIEnglishTeacher.Shared
{
    public class AudioCacheService : IAudioCacheService
    {
        private static readonly ConcurrentDictionary<long, string> _audioCache = new();
        private const int AUDIO_CACHE_TIMEOUT = 60000; // 音频缓存超时时间（毫秒）

        public void StoreAudioData(long messageId, string audioData)
        {
            if (_audioCache.TryAdd(messageId, audioData))
            {
                StartCleanupTimer(messageId);
            }
        }

        private void StartCleanupTimer(long messageId)
        {
            var timer = new System.Threading.Timer(
                state => 
                {
                    _audioCache.TryRemove(messageId, out _);
                    ((System.Threading.Timer)state!).Dispose();
                },
                null,
                AUDIO_CACHE_TIMEOUT,
                Timeout.Infinite);
        }

        public bool TryGetAudioData(long messageId, out string audioData)
        {
            if (_audioCache.TryGetValue(messageId, out var value))
            {
                audioData = value;
                return true;
            }
            audioData = string.Empty;
            return false;
        }

        public bool TryRemoveAudioData(long messageId, out string audioData)
        {
            if (_audioCache.TryRemove(messageId, out var value))
            {
                audioData = value;
                return true;
            }
            audioData = string.Empty;
            return false;
        }
    }
} 