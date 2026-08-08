import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export function usePlayer({ cacheTrack }) {
  const audioRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const playTrack = useCallback(
    async (track, tracks = []) => {
      const hasAudio = Boolean(track?.audio_url || track?.file_id);
      setCurrentTrack(track);
      setQueue(tracks);
      setQueueIndex(tracks.findIndex((t) => t.id === track.id));
      setIsPlaying(true);
      if (cacheTrack && hasAudio) cacheTrack(track);
      if (!hasAudio) {
        toast.info(`No audio source for "${track?.title}".`);
      }
      setTimeout(() => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((e) => console.log(e));
      }, 100);
    },
    [cacheTrack]
  );

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.log(err));
    }
  }, [isPlaying]);

  const skip = useCallback(
    (direction) => {
      if (direction > 0) {
        if (queueIndex + 1 < queue.length) {
          playTrack(queue[queueIndex + 1], queue);
        }
      } else if (queueIndex - 1 >= 0) {
        playTrack(queue[queueIndex - 1], queue);
      }
    },
    [queue, queueIndex, playTrack]
  );

  const onTimeUpdate = useCallback(
    () => setCurrentTime(audioRef.current?.currentTime || 0),
    []
  );

  const onLoadedMetadata = useCallback(
    () => setDuration(audioRef.current?.duration || 0),
    []
  );

  const setVolumeLevel = useCallback((v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  return {
    audioRef,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playTrack,
    togglePlay,
    skip,
    onTimeUpdate,
    onLoadedMetadata,
    setVolumeLevel,
  };
}