class ApplicationController < ActionController::API
  def render_problem(status:, title:, detail:)
    render json: {
      type: "about:blank",
      title: title,
      status: Rack::Utils::SYMBOL_TO_STATUS_CODE[status] || status,
      detail: detail,
      instance: request.original_fullpath
    }, status: status, content_type: "application/problem+json"
  end

  def authenticate_user!
    header = request.headers["Authorization"]
    token = header.split(" ").last if header

    begin
      decoded = JWT.decode(token, ENV.fetch("JWT_SECRET", "hackathon-rails-jwt-secret-key"), true, { algorithm: "HS256" })
      @current_user_id = decoded[0]["sub"]
    rescue JWT::DecodeError
      render_problem(status: :unauthorized, title: "Unauthorized", detail: "Token invalid or missing")
    end
  end
end
