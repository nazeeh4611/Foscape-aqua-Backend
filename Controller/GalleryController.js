// backend/controllers/galleryController.js
import Gallery from '../Model/GalleryModel.js';
import axios from 'axios';

const fetchInstagramThumbnail = async (url) => {
  try {
    const res = await axios.get(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    return res.data.data.image?.url || '';
  } catch {
    return '';
  }
};

const getYouTubeIdFromUrl = (url) => {
  try {
    if (!url) return '';
    if (url.includes('shorts/')) return url.split('shorts/')[1].split('?')[0];
    if (url.includes('watch?v=')) return url.split('watch?v=')[1].split('&')[0];
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
    if (url.includes('/embed/')) return url.split('/embed/')[1].split('?')[0];
    return '';
  } catch {
    return '';
  }
};

const getYouTubeThumbnail = (url) => {
  const id = getYouTubeIdFromUrl(url);
  if (!id) return '';
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
};

export const getAllGalleries = async (req, res) => {
  try {
    const galleries = await Gallery.find({ status: 'Active' }).sort({ createdAt: -1 });
    const updated = await Promise.all(
      galleries.map(async (item) => {
        const doc = item._doc ? item._doc : item;
        let thumbnail = doc.thumbnailUrl || doc.thumbnail || doc.thumbnailUrl === null ? doc.thumbnailUrl : null;
        if ((!thumbnail || thumbnail === '') && doc.mediaType === 'instagram') {
          const thumb = await fetchInstagramThumbnail(doc.mediaUrls[0]);
          thumbnail = thumb || '';
        }
        if ((!thumbnail || thumbnail === '') && doc.mediaType === 'youtube') {
          const thumb = getYouTubeThumbnail(doc.mediaUrls[0]);
          thumbnail = thumb || '';
        }
        return { ...doc, thumbnailUrl: thumbnail || null };
      })
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getGalleryById = async (req, res) => {
  try {
    const gallery = await Gallery.findById(req.params.id);
    if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
    res.status(200).json(gallery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createGallery = async (req, res) => {
  try {
    const newGallery = new Gallery(req.body);
    await newGallery.save();
    res.status(201).json(newGallery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateGallery = async (req, res) => {
  try {
    const updatedGallery = await Gallery.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedGallery) return res.status(404).json({ message: 'Gallery not found' });
    res.status(200).json(updatedGallery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteGallery = async (req, res) => {
  try {
    const deletedGallery = await Gallery.findByIdAndDelete(req.params.id);
    if (!deletedGallery) return res.status(404).json({ message: 'Gallery not found' });
    res.status(200).json({ message: 'Gallery deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
