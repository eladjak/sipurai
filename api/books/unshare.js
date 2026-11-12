// POST /api/books/unshare  { bookId }
// Stops sharing a book the SIGNED-IN parent owns: books.is_public=false and its community posts (and their comments) removed.
import { bookRoute } from '../_lib/bookRoute.js';
import { unshareBook } from '../_lib/bookControls.js';

export default bookRoute(unshareBook);
