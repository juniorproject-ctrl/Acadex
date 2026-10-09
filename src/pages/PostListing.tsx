import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Plus, X } from 'lucide-react';
import { api, type ApiListing } from '../lib/api';
import {
  listingCategories,
  listingConditions,
  type ListingCategory,
  type ListingCondition,
} from '../lib/demoListings';

type SelectedImage = { file?: File; preview: string };

export default function PostListing() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ListingCategory | ''>('');
  const [condition, setCondition] = useState<ListingCondition | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [drafts, setDrafts] = useState<ApiListing[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.myListings()
      .then((result) => setDrafts(result.listings.filter((listing) => listing.status === 'draft')))
      .catch(() => setDrafts([]));
  }, []);

  const continueDraft = (draft: ApiListing) => {
    setEditingId(draft.id);
    setTitle(draft.title === 'Untitled draft' ? '' : draft.title);
    setPrice(draft.price ? String(draft.price) : '');
    setCategory(draft.category as ListingCategory);
    setCondition(draft.condition as ListingCondition);
    setDescription(draft.description);
    setLocation(draft.location);
    setImages(draft.images.map((preview) => ({ preview })));
    setSuccess('Draft loaded. You can continue editing it.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files) {
      const newImages = Array.from(files).map((file) => ({ file, preview: URL.createObjectURL(file) }));
      setImages((prev) => [...prev, ...newImages].slice(0, 5));
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const image = prev[index];
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const saveListing = async (status: 'draft' | 'active') => {
    setError('');
    setSuccess('');
    if (status === 'active' && (!title.trim() || !price || !category || !condition || !description.trim() || !location.trim())) {
      setError('Please complete the title, price, category, condition, description, and location.');
      return;
    }
    if (status === 'active' && description.trim().length < 20) {
      setError('Please make the description a little more detailed so buyers understand the item.');
      return;
    }
    if (status === 'active' && !images.length) {
      setError('Please upload at least one image for the listing.');
      return;
    }
    if (status === 'active' && !agreed) {
      setError('Please agree to the listing guidelines before publishing.');
      return;
    }

    const formData = new FormData();
    formData.append('status', status);
    formData.append('title', title);
    formData.append('price', price);
    formData.append('category', category);
    formData.append('condition', condition);
    formData.append('description', description);
    formData.append('location', location);
    images.forEach((image) => { if (image.file) formData.append('images', image.file); });
    try {
      if (editingId) await api.updateListing(editingId, formData);
      else await api.createListing(formData);
      setSuccess(status === 'draft' ? 'Draft saved. You can return later to continue it.' : 'Your listing was published.');
      window.setTimeout(() => navigate('/browse'), 700);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the listing.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void saveListing('active');
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl text-brand-navy mb-2">Create New Listing</h1>
        <p className="text-brand-light-navy text-sm">Fill in the details below to list your item for sale</p>
        {drafts.length > 0 && !editingId && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {drafts.map((draft) => <button key={draft.id} type="button" onClick={() => continueDraft(draft)} className="text-xs font-bold text-brand-navy border border-brand-navy px-3 py-2 rounded">Continue draft: {draft.title}</button>)}
          </div>
        )}
      </div>

      <div className="bg-[#E5E7EB] p-8 md:p-12 rounded-2xl shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && <div className="bg-red-100 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>}
          {success && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-sm font-medium">{success}</div>}

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-brand-navy">Item Photos</h3>
            <div className="flex flex-wrap gap-4">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />

              <div
                onClick={triggerFileInput}
                className={`w-40 h-52 bg-white border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-navy transition-colors relative overflow-hidden group ${images[0] ? 'border-solid' : ''}`}
              >
                {images[0] ? (
                  <>
                  <img src={images[0].preview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(0); }}
                      className="absolute top-2 right-2 bg-brand-navy text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-brand-navy bg-opacity-70 text-white text-[8px] font-bold py-1">MAIN PHOTO</div>
                  </>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-[10px] text-gray-500 font-bold px-4 leading-tight">Add Main Photo</span>
                  </>
                )}
              </div>

              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  onClick={triggerFileInput}
                  className={`w-20 h-20 bg-white bg-opacity-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-brand-navy relative overflow-hidden group ${images[i] ? 'border-solid bg-opacity-100' : ''}`}
                >
                  {images[i] ? (
                    <>
                      <img src={images[i].preview} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                        className="absolute top-1 right-1 bg-brand-navy text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </>
                  ) : (
                    <Plus className="w-6 h-6 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500">Upload up to 5 photos. First photo will be the cover.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-navy block">Item Title</label>
              <input type="text" placeholder="Enter a descriptive title" className="w-full bg-white border-none rounded-lg p-3 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-navy block">Price</label>
              <div className="relative">
                <input type="number" placeholder="0.00" className="w-full bg-white border-none rounded-lg p-3 text-sm pr-12 text-right" value={price} onChange={(e) => setPrice(e.target.value)} min="0" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-light-navy">AED</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-navy block">Category</label>
              <select className="w-full bg-white border-none rounded-lg p-3 text-sm appearance-none cursor-pointer" value={category} onChange={(e) => setCategory(e.target.value as ListingCategory | '')}>
                <option value="">Select a category</option>
                {listingCategories.map((listingCategory) => (
                  <option key={listingCategory} value={listingCategory}>{listingCategory}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-navy block">Condition</label>
              <select className="w-full bg-white border-none rounded-lg p-3 text-sm appearance-none cursor-pointer" value={condition} onChange={(e) => setCondition(e.target.value as ListingCondition | '')}>
                <option value="">Select condition</option>
                {listingConditions.map((listingCondition) => (
                  <option key={listingCondition} value={listingCondition}>{listingCondition}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-brand-navy block">Description</label>
            <textarea
              rows={6}
              placeholder="Describe your item in detail. Include information about brand, model, size, color, defects, and any other relevant details..."
              className="w-full bg-white border-none rounded-lg p-4 text-sm resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
            <p className="text-[10px] text-gray-500">Minimum 20 characters</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-navy block">Location</label>
              <input type="text" placeholder="City / Emirate" className="w-full bg-white border-none rounded-lg p-3 text-sm" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-4">
              <label className="text-sm font-bold text-brand-navy block">Delivery Options</label>
              <div className="space-y-3">
                <label className="flex items-center text-xs font-bold text-brand-navy cursor-pointer">
                  <input type="checkbox" className="mr-3 rounded border-none bg-white w-4 h-4 shadow-sm" defaultChecked />
                  Local Pickup
                </label>
                <label className="flex items-center text-xs font-bold text-brand-navy cursor-pointer">
                  <input type="checkbox" className="mr-3 rounded border-none bg-white w-4 h-4 shadow-sm" />
                  Shipping Available
                </label>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between border-t border-gray-300">
            <label className="flex items-center text-[10px] text-brand-light-navy cursor-pointer mb-6 md:mb-0">
              <input type="checkbox" className="mr-2 rounded border-none bg-white" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              I agree to the <span className="underline ml-1">Terms of Service</span> and <span className="underline ml-1">Listing Guidelines</span>
            </label>
            <div className="flex space-x-4 w-full md:w-auto">
              <button type="button" onClick={() => void saveListing('draft')} className="flex-1 md:flex-none px-10 py-3 bg-[#A6B1C2] text-white font-bold rounded-lg hover:bg-gray-500 transition-colors">
                Save as Draft
              </button>
              <button type="submit" className="flex-1 md:flex-none px-10 py-3 bg-brand-navy text-white font-bold rounded-lg hover:bg-brand-light-navy transition-colors">
                Publish Listing
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
