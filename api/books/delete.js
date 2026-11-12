// POST /api/books/delete  { bookId }
// Deletes a book the SIGNED-IN parent owns: pages, community posts and comments, the book row, and its image files.
import { bookRoute } from '../_lib/bookRoute.js';
import { deleteBook } from '../_lib/bookControls.js';

export default bookRoute(deleteBook);
