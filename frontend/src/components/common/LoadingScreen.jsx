import PropTypes from 'prop-types'
import Spinner from 'react-bootstrap/Spinner'

const LoadingScreen = ({ message = '読み込み中です' }) => (
  <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 gap-3">
    <Spinner animation="border" variant="primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </Spinner>
    <p className="text-muted mb-0">{message}</p>
  </div>
)

LoadingScreen.propTypes = {
  message: PropTypes.string,
}

export default LoadingScreen
