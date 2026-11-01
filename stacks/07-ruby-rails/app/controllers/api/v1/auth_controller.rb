module Api
  module V1
    class AuthController < ApplicationController
      before_action :authenticate_user!, only: [:me]

      # In-memory storage simulation for zero-dependency hackathon setup
      @@users ||= {}

      def signup
        email = params[:email]
        username = params[:username]
        password = params[:password]

        if email.blank? || username.blank? || password.blank?
          return render_problem(status: :bad_request, title: "Validation Error", detail: "Email, username, and password are required")
        end

        if @@users.values.any? { |u| u[:email] == email || u[:username] == username }
          return render_problem(status: :conflict, title: "Conflict", detail: "User with this email or username already exists")
        end

        id = "usr_#{SecureRandom.hex(4)}"
        password_digest = BCrypt::Password.create(password)
        user = { id: id, email: email, username: username, password_digest: password_digest }
        @@users[id] = user

        render json: { id: user[:id], email: user[:email], username: user[:username] }, status: :created
      end

      def login
        username_or_email = params[:username_or_email]
        password = params[:password]

        user = @@users.values.find { |u| u[:email] == username_or_email || u[:username] == username_or_email }

        if user.nil? || BCrypt::Password.new(user[:password_digest]) != password
          return render_problem(status: :unauthorized, title: "Unauthorized", detail: "Invalid credentials")
        end

        payload = { sub: user[:id], username: user[:username], exp: 24.hours.from_now.to_i }
        token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "hackathon-rails-jwt-secret-key"), "HS256")

        render json: {
          access_token: token,
          token_type: "bearer",
          user: { id: user[:id], username: user[:username], email: user[:email] }
        }
      end

      def me
        user = @@users[@current_user_id]
        if user
          render json: { id: user[:id], username: user[:username], email: user[:email] }
        else
          render_problem(status: :not_found, title: "Not Found", detail: "User not found")
        end
      end
    end
  end
end

