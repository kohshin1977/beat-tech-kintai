import { useState } from 'react'
import { Button, Card, Col, Container, Form, Row } from 'react-bootstrap'
import { Navigate, useLocation } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import ErrorAlert from '../components/common/ErrorAlert.jsx'
import { auth } from '../firebase/config.js'
import { useAuth } from '../context/AuthContext.jsx'

const LoginPage = () => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fromPath = location.state?.from?.pathname

  if (!loading && user && profile?.role) {
    const canUseFromPath = fromPath?.startsWith('/employee')
    if (canUseFromPath) {
      return <Navigate to={fromPath} replace />
    }

    return <Navigate to="/employee" replace />
  }

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('メールアドレスとパスワードを入力してください。')
      return
    }

    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password)
    } catch (authError) {
      console.error('Failed to sign in', authError)
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={5}>
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              <div className="mb-4 text-center">
                <h1 className="h4 fw-bold">勤怠管理ログイン</h1>
                <p className="text-muted small mb-0">メールアドレスとパスワードを入力してください</p>
              </div>

              <ErrorAlert message={error} onClose={() => setError('')} />

              <Form onSubmit={handleSubmit}>
                <Form.Group controlId="login-email" className="mb-3">
                  <Form.Label>メールアドレス</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="example@company.jp"
                    value={form.email}
                    onChange={handleChange('email')}
                    autoComplete="email"
                    required
                  />
                </Form.Group>

                <Form.Group controlId="login-password" className="mb-4">
                  <Form.Label>パスワード</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange('password')}
                    autoComplete="current-password"
                    required
                  />
                </Form.Group>

                <div className="d-grid">
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? 'ログイン中…' : 'ログイン'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  )
}

export default LoginPage
