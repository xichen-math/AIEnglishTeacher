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
            try
            {
                var timer = new System.Threading.Timer(
                    state => 
                    {
                        try
                        {
                            _audioCache.TryRemove(messageId, out _);
                            var timerInstance = state as System.Threading.Timer;
                            timerInstance?.Dispose();
                        }
                        catch (Exception ex)
                        {
                            // 记录错误但不抛出异常，以防止应用程序崩溃
                            System.Diagnostics.Debug.WriteLine($"清理音频缓存时出错: {ex.Message}");
                        }
                    },
                    null,  // 初始状态为null
                    AUDIO_CACHE_TIMEOUT,
                    Timeout.Infinite);

                // 设置timer自身作为state
                timer.Change(AUDIO_CACHE_TIMEOUT, Timeout.Infinite);
            }
            catch (Exception ex)
            {
                // 记录错误但不抛出异常，以防止应用程序崩溃
                System.Diagnostics.Debug.WriteLine($"创建清理定时器时出错: {ex.Message}");
            }
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