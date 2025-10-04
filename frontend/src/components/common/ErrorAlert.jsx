import PropTypes from 'prop-types'
import Alert from 'react-bootstrap/Alert'

const ErrorAlert = ({ message, onClose }) => {
  if (!message) return null

  return (
    <Alert variant="danger" onClose={onClose} dismissible>
      {message}
    </Alert>
  )
}

ErrorAlert.propTypes = {
  message: PropTypes.string,
  onClose: PropTypes.func,
}

ErrorAlert.defaultProps = {
  message: '',
  onClose: undefined,
}

export default ErrorAlert
