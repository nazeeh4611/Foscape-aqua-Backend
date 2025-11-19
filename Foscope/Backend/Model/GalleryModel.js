import mongoose from 'mongoose';

const gallerySchema = new mongoose.Schema(
  {
    heading: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'instagram', 'youtube'],
      required: true,
    },
    mediaUrls: {
      type: [String],
      required: true,
      validate: {
        validator: function(v) {
          return v && v.length > 0 && v.length <= 10;
        },
        message: 'Must have between 1 and 3 media URLs'
      }
    },
    // Thumbnail for Instagram/YouTube posts
    thumbnailUrl: {
      type: String,
      required: function() {
        return this.mediaType === 'instagram' || this.mediaType === 'youtube';
      },
      default: null
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

const Gallery = mongoose.model('Gallery', gallerySchema);

export default Gallery;